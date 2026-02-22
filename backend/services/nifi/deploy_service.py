"""Application service for NiFi flow deployment orchestration."""

import json
import logging
import urllib3

from core.models import Setting
from core.database import get_db_session
from repositories.nifi.nifi_instance_repository import NifiInstanceRepository
from repositories.nifi.registry_flow_repository import RegistryFlowRepository
from services.nifi.connection import nifi_connection_service
from services.nifi.deployment import (
    NiFiDeploymentService,
    find_or_create_process_group_by_path,
)

# Suppress InsecureRequestWarning for HTTPS requests
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

_instance_repo = NifiInstanceRepository()
_registry_flow_repo = RegistryFlowRepository()


def deploy_flow(instance_id: int, deployment_data: dict) -> dict:
    """Orchestrate the full deployment pipeline."""
    logger.info("=" * 60)
    logger.info("DEPLOYMENT STARTED")
    logger.info("=" * 60)
    logger.info("Instance ID: %s", instance_id)
    logger.info(
        "Deployment data: %s", json.dumps(deployment_data, indent=2, default=str)
    )

    instance = _instance_repo.get_by_id(instance_id)
    if not instance:
        raise ValueError("NiFi instance with ID %d not found" % instance_id)

    logger.info(
        "Target Instance: %s (hierarchy: %s=%s)",
        instance.name,
        instance.hierarchy_attribute,
        instance.hierarchy_value,
    )

    parent_pg_id = deployment_data.get("parent_process_group_id")
    parent_pg_path = deployment_data.get("parent_process_group_path")

    if not parent_pg_id and not parent_pg_path:
        raise ValueError(
            "Either parent_process_group_id or parent_process_group_path is required"
        )

    # Configure NiFi connection
    logger.info("Configuring NiFi connection to %s", instance.nifi_url)
    nifi_connection_service.configure_from_instance(instance, normalize_url=True)

    # Determine hierarchy attribute
    hierarchy_attr = (
        deployment_data.get("hierarchy_attribute") or _get_last_hierarchy_attr()
    )
    logger.info("Hierarchy attribute: %s", hierarchy_attr)

    service = NiFiDeploymentService(hierarchy_attr)

    logger.info("=" * 60)
    logger.info("STEP 1: Get Registry Info")
    logger.info("=" * 60)
    template_id = deployment_data.get("template_id")
    bucket_id = deployment_data.get("bucket_id")
    flow_id = deployment_data.get("flow_id")
    registry_client_id = deployment_data.get("registry_client_id")
    template_name = None

    if template_id:
        logger.info("Using template_id: %s", template_id)
        template = _registry_flow_repo.get_by_id(template_id)
        if not template:
            raise ValueError("Template with ID %d not found" % template_id)
        bucket_id = template.bucket_id
        flow_id = template.flow_id
        registry_client_id = template.registry_id
        template_name = template.flow_name
        logger.info(
            "Template resolved: name=%s, bucket_id=%s, flow_id=%s, registry_id=%s",
            template_name,
            bucket_id,
            flow_id,
            registry_client_id,
        )
    elif not bucket_id or not flow_id or not registry_client_id:
        raise ValueError(
            "Either template_id or (bucket_id, flow_id, registry_client_id) must be provided"
        )
    else:
        logger.info(
            "Using direct registry info: bucket_id=%s, flow_id=%s, registry_id=%s",
            bucket_id,
            flow_id,
            registry_client_id,
        )

    logger.info("=" * 60)
    logger.info("STEP 2: Resolve Parent Process Group")
    logger.info("=" * 60)
    logger.info("parent_process_group_id (from request): %s", parent_pg_id)
    logger.info("parent_process_group_path (from request): %s", parent_pg_path)

    if parent_pg_id:
        resolved_parent_pg_id = parent_pg_id
        logger.info(
            "✅ Using provided parent process group ID: %s", resolved_parent_pg_id
        )
    else:
        logger.info("🔍 Resolving parent process group by path: '%s'", parent_pg_path)
        resolved_parent_pg_id = find_or_create_process_group_by_path(
            parent_pg_path or ""
        )
        logger.info("✅ Resolved parent process group ID: %s", resolved_parent_pg_id)

    logger.info("=" * 60)
    logger.info("STEP 3: Get Bucket and Flow Identifiers")
    logger.info("=" * 60)
    bucket_identifier, flow_identifier = service.get_bucket_and_flow_identifiers(
        bucket_id, flow_id, registry_client_id
    )
    logger.info("Bucket identifier: %s", bucket_identifier)
    logger.info("Flow identifier: %s", flow_identifier)

    logger.info("=" * 60)
    logger.info("STEP 4: Determine Version to Deploy")
    logger.info("=" * 60)

    requested_version = deployment_data.get("version")
    logger.info(
        "Requested version: %s", requested_version if requested_version else "latest"
    )
    deploy_version = service.get_deploy_version(
        requested_version, registry_client_id, bucket_identifier, flow_identifier
    )
    logger.info("Version to deploy: %s", deploy_version)

    logger.info("=" * 60)
    logger.info("STEP 5: Check for Existing Process Group")
    logger.info("=" * 60)
    process_group_name = deployment_data.get("process_group_name")
    logger.info("Target process group name: %s", process_group_name)
    service.check_existing_process_group(process_group_name, resolved_parent_pg_id)
    logger.info("No existing process group found or check passed")

    logger.info("=" * 60)
    logger.info("STEP 6: Deploy Flow Version")
    logger.info("=" * 60)

    # Determine deploy position using nipyapi.layout if available
    x_position = deployment_data.get("x_position", 0)
    y_position = deployment_data.get("y_position", 0)
    try:
        import nipyapi.layout

        logger.info(
            "Aligning existing process groups in parent PG %s into grid",
            resolved_parent_pg_id,
        )
        moves = nipyapi.layout.align_pg_grid(resolved_parent_pg_id, sort_by_name=True)
        logger.info("Grid alignment moved %d process groups", len(moves))
        pos = nipyapi.layout.suggest_pg_position(resolved_parent_pg_id)
        x_position, y_position = pos
        logger.info("Suggested position for new PG: x=%s, y=%s", x_position, y_position)
    except (ImportError, AttributeError):
        logger.info(
            "nipyapi.layout not available, using manual position: x=%s, y=%s",
            x_position,
            y_position,
        )
    except Exception as e:
        logger.warning(
            "Layout auto-positioning failed, falling back to manual position x=%s, y=%s: %s",
            x_position,
            y_position,
            e,
        )

    logger.info("Deploying to parent PG: %s", resolved_parent_pg_id)
    deployed_pg = service.deploy_flow_version(
        resolved_parent_pg_id,
        bucket_identifier,
        flow_identifier,
        registry_client_id,
        deploy_version,
        x_position,
        y_position,
    )

    pg_id = deployed_pg.id if hasattr(deployed_pg, "id") else None
    logger.info("Flow deployed successfully! Process Group ID: %s", pg_id)

    logger.info("=" * 60)
    logger.info("STEP 7: Rename Process Group")
    logger.info("=" * 60)
    original_name = (
        deployed_pg.component.name if hasattr(deployed_pg, "component") else "unknown"
    )
    logger.info("Renaming from '%s' to '%s'", original_name, process_group_name)
    _, pg_name = service.rename_process_group(deployed_pg, process_group_name)
    deployed_version = service.extract_deployed_version(deployed_pg)
    logger.info("Process group renamed successfully to: %s", pg_name)
    logger.info("Deployed version: %s", deployed_version)

    logger.info("=" * 60)
    logger.info("STEP 8: Assign Parameter Context")
    logger.info("=" * 60)

    parameter_context_name = deployment_data.get("parameter_context_name")
    parameter_context_id = deployment_data.get("parameter_context_id")

    if pg_id and parameter_context_name:
        logger.info("Assigning parameter context by name: %s", parameter_context_name)
        try:
            service.assign_parameter_context(pg_id, parameter_context_name)
            logger.info(
                "Parameter context '%s' assigned successfully to PG %s",
                parameter_context_name,
                pg_id,
            )
        except Exception as e:
            logger.error(
                "Failed to assign parameter context by name: %s", e, exc_info=True
            )
            raise
    elif pg_id and parameter_context_id:
        logger.info("Assigning parameter context by ID: %s", parameter_context_id)
        try:
            import nipyapi
            from nipyapi.nifi import ProcessGroupsApi

            pg_api = ProcessGroupsApi()
            pg = pg_api.get_process_group(id=pg_id)
            nipyapi.parameters.assign_context_to_process_group(
                pg=pg, context_id=parameter_context_id, cascade=False
            )
            logger.info(
                "Parameter context ID '%s' assigned successfully to PG %s",
                parameter_context_id,
                pg_id,
            )
        except Exception as e:
            logger.error(
                "Failed to assign parameter context by ID: %s", e, exc_info=True
            )
            logger.warning("Could not assign parameter context: %s", e)
    else:
        logger.info(
            "No parameter context to assign (parameter_context_name=%s, parameter_context_id=%s)",
            parameter_context_name,
            parameter_context_id,
        )

    logger.info("=" * 60)
    logger.info("STEP 9: Auto-Connect Ports")
    logger.info("=" * 60)
    if pg_id and resolved_parent_pg_id:
        logger.info(
            "Auto-connecting ports for PG %s in parent %s", pg_id, resolved_parent_pg_id
        )
        try:
            service.auto_connect_ports(pg_id, resolved_parent_pg_id)
            logger.info("Ports auto-connected successfully")
        except Exception as e:
            logger.warning("Port auto-connection failed or not needed: %s", e)
    else:
        logger.info(
            "Skipping port auto-connection (pg_id=%s, parent_pg_id=%s)",
            pg_id,
            resolved_parent_pg_id,
        )

    logger.info("=" * 60)
    logger.info("STEP 10: Stop Version Control (if requested)")
    logger.info("=" * 60)

    if pg_id and deployment_data.get("stop_versioning_after_deploy"):
        logger.info("Stopping version control for PG %s", pg_id)
        try:
            service.stop_version_control(pg_id)
            logger.info("Version control stopped successfully")
        except Exception as e:
            logger.error("Failed to stop version control: %s", e, exc_info=True)
    else:
        logger.info(
            "Skipping version control stop (pg_id=%s, stop_versioning=%s)",
            pg_id,
            deployment_data.get("stop_versioning_after_deploy"),
        )

    logger.info("=" * 60)
    logger.info("STEP 11: Disable Process Group (if requested)")
    logger.info("=" * 60)
    if pg_id and deployment_data.get("disable_after_deploy"):
        logger.info("Disabling process group %s", pg_id)
        try:
            service.disable_process_group(pg_id)
            logger.info("Process group disabled successfully")
        except Exception as e:
            logger.error("Failed to disable process group: %s", e, exc_info=True)
    else:
        logger.info(
            "Skipping process group disable (pg_id=%s, disable_after_deploy=%s)",
            pg_id,
            deployment_data.get("disable_after_deploy"),
        )

    logger.info("=" * 60)
    logger.info("STEP 12: Start Process Group (if requested)")
    logger.info("=" * 60)

    if pg_id and deployment_data.get("start_after_deploy"):
        logger.info("Starting process group %s", pg_id)
        try:
            service.start_process_group(pg_id)
            logger.info("Process group started successfully")
        except Exception as e:
            logger.error("Failed to start process group: %s", e, exc_info=True)
    else:
        logger.info(
            "Skipping process group start (pg_id=%s, start_after_deploy=%s)",
            pg_id,
            deployment_data.get("start_after_deploy"),
        )

    logger.info("=" * 60)
    logger.info("DEPLOYMENT COMPLETED SUCCESSFULLY")
    logger.info("=" * 60)
    message = "Flow deployed successfully to %s=%s" % (
        instance.hierarchy_attribute,
        instance.hierarchy_value,
    )
    if template_name:
        message += " using template '%s'" % template_name

    result = {
        "status": "success",
        "message": message,
        "process_group_id": pg_id,
        "process_group_name": pg_name,
        "instance_id": instance_id,
        "bucket_id": bucket_identifier,
        "flow_id": flow_identifier,
        "version": deployed_version or deployment_data.get("version"),
    }

    logger.info("Final result: %s", json.dumps(result, indent=2))
    logger.info("=" * 60)

    return result


def _get_last_hierarchy_attr() -> str:
    """Get the last hierarchy attribute name from settings."""
    db = get_db_session()
    try:
        setting = db.query(Setting).filter(Setting.key == "hierarchy_config").first()
        if setting and setting.value:
            try:
                config = json.loads(setting.value)
                hierarchy_list = None
                if isinstance(config, dict) and "hierarchy" in config:
                    hierarchy_list = config["hierarchy"]
                elif isinstance(config, list):
                    hierarchy_list = config

                if hierarchy_list and len(hierarchy_list) > 0:
                    last_item = hierarchy_list[-1]
                    if isinstance(last_item, dict) and "name" in last_item:
                        return last_item["name"]
            except (json.JSONDecodeError, Exception):
                pass
        return "cn"
    finally:
        db.close()
