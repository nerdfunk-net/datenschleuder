"""Application service for NiFi flow deployment orchestration."""

import json
import logging
from typing import Optional

from core.models import NifiInstance, Setting
from core.database import get_db_session
from repositories.nifi.nifi_instance_repository import NifiInstanceRepository
from repositories.nifi.registry_flow_repository import RegistryFlowRepository
from services.nifi.connection import nifi_connection_service
from services.nifi.deployment import NiFiDeploymentService, find_or_create_process_group_by_path

logger = logging.getLogger(__name__)

_instance_repo = NifiInstanceRepository()
_registry_flow_repo = RegistryFlowRepository()


def deploy_flow(instance_id: int, deployment_data: dict) -> dict:
    """Orchestrate the full deployment pipeline."""
    instance = _instance_repo.get_by_id(instance_id)
    if not instance:
        raise ValueError("NiFi instance with ID %d not found" % instance_id)

    parent_pg_id = deployment_data.get("parent_process_group_id")
    parent_pg_path = deployment_data.get("parent_process_group_path")

    if not parent_pg_id and not parent_pg_path:
        raise ValueError("Either parent_process_group_id or parent_process_group_path is required")

    # Configure NiFi connection
    nifi_connection_service.configure_from_instance(instance, normalize_url=True)

    # Determine hierarchy attribute
    hierarchy_attr = deployment_data.get("hierarchy_attribute") or _get_last_hierarchy_attr()

    service = NiFiDeploymentService(hierarchy_attr)

    # Step 1: Get registry info
    template_id = deployment_data.get("template_id")
    bucket_id = deployment_data.get("bucket_id")
    flow_id = deployment_data.get("flow_id")
    registry_client_id = deployment_data.get("registry_client_id")
    template_name = None

    if template_id:
        template = _registry_flow_repo.get_by_id(template_id)
        if not template:
            raise ValueError("Template with ID %d not found" % template_id)
        bucket_id = template.bucket_id
        flow_id = template.flow_id
        registry_client_id = template.registry_id
        template_name = template.flow_name
    elif not bucket_id or not flow_id or not registry_client_id:
        raise ValueError(
            "Either template_id or (bucket_id, flow_id, registry_client_id) must be provided"
        )

    # Step 2: Resolve parent PG
    if parent_pg_id:
        resolved_parent_pg_id = parent_pg_id
    else:
        resolved_parent_pg_id = find_or_create_process_group_by_path(parent_pg_path or "")

    # Step 3: Get bucket and flow identifiers
    bucket_identifier, flow_identifier = service.get_bucket_and_flow_identifiers(
        bucket_id, flow_id, registry_client_id
    )

    # Step 4: Determine version
    deploy_version = service.get_deploy_version(
        deployment_data.get("version"), registry_client_id, bucket_identifier, flow_identifier
    )

    # Step 5: Check for existing PG
    process_group_name = deployment_data.get("process_group_name")
    service.check_existing_process_group(process_group_name, resolved_parent_pg_id)

    # Step 6: Deploy
    deployed_pg = service.deploy_flow_version(
        resolved_parent_pg_id,
        bucket_identifier,
        flow_identifier,
        registry_client_id,
        deploy_version,
        deployment_data.get("x_position", 0),
        deployment_data.get("y_position", 0),
    )

    pg_id = deployed_pg.id if hasattr(deployed_pg, "id") else None

    # Step 7: Rename
    _, pg_name = service.rename_process_group(deployed_pg, process_group_name)
    deployed_version = service.extract_deployed_version(deployed_pg)

    # Step 8: Assign parameter context
    parameter_context_name = deployment_data.get("parameter_context_name")
    parameter_context_id = deployment_data.get("parameter_context_id")

    if pg_id and parameter_context_name:
        service.assign_parameter_context(pg_id, parameter_context_name)
    elif pg_id and parameter_context_id:
        try:
            import nipyapi
            from nipyapi.nifi import ProcessGroupsApi

            pg_api = ProcessGroupsApi()
            pg = pg_api.get_process_group(id=pg_id)
            nipyapi.parameters.assign_context_to_process_group(
                pg=pg, context_id=parameter_context_id, cascade=False
            )
        except Exception as e:
            logger.warning("Could not assign parameter context: %s", e)

    # Step 9: Auto-connect ports
    if pg_id and resolved_parent_pg_id:
        service.auto_connect_ports(pg_id, resolved_parent_pg_id)

    # Step 10: Stop version control
    if pg_id and deployment_data.get("stop_versioning_after_deploy"):
        service.stop_version_control(pg_id)

    # Step 11: Disable
    if pg_id and deployment_data.get("disable_after_deploy"):
        service.disable_process_group(pg_id)

    # Step 12: Start
    if pg_id and deployment_data.get("start_after_deploy"):
        service.start_process_group(pg_id)

    # Build response
    message = "Flow deployed successfully to %s=%s" % (
        instance.hierarchy_attribute,
        instance.hierarchy_value,
    )
    if template_name:
        message += " using template '%s'" % template_name

    return {
        "status": "success",
        "message": message,
        "process_group_id": pg_id,
        "process_group_name": pg_name,
        "instance_id": instance_id,
        "bucket_id": bucket_identifier,
        "flow_id": flow_identifier,
        "version": deployed_version or deployment_data.get("version"),
    }


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
