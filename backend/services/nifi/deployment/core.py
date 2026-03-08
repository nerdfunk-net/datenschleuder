"""Core NiFi flow deployment operations."""

import logging
from typing import Optional, Any, Tuple

from nipyapi import versioning, canvas
from nipyapi.nifi import ProcessGroupsApi

logger = logging.getLogger(__name__)


def check_existing_process_group(
    process_group_name: Optional[str], parent_pg_id: str
) -> None:
    """Check if process group with same name already exists. Raises if exists."""
    if not process_group_name:
        return

    pg_api = ProcessGroupsApi()
    try:
        parent_pg_response = pg_api.get_process_groups(id=parent_pg_id)

        if hasattr(parent_pg_response, "process_groups"):
            for pg in parent_pg_response.process_groups:
                if (
                    hasattr(pg, "component")
                    and hasattr(pg.component, "name")
                    and pg.component.name == process_group_name
                ):
                    raise ValueError(
                        "Process group '%s' already exists (id: %s)"
                        % (process_group_name, pg.id)
                    )
    except ValueError:
        raise
    except Exception as check_error:
        logger.warning(
            "Could not check for existing process group: %s", check_error
        )


def deploy_flow_version(
    parent_pg_id: str,
    bucket_identifier: str,
    flow_identifier: str,
    reg_client_id: str,
    deploy_version: Optional[int],
    x_position: int = 0,
    y_position: int = 0,
) -> Any:
    """Deploy flow version to NiFi."""
    logger.info(
        "Deploying flow - Bucket: %s, Flow: %s, Version: %s",
        bucket_identifier,
        flow_identifier,
        deploy_version,
    )

    deployed_pg = versioning.deploy_flow_version(
        parent_id=parent_pg_id,
        location=(float(x_position), float(y_position)),
        bucket_id=bucket_identifier,
        flow_id=flow_identifier,
        reg_client_id=reg_client_id,
        version=deploy_version,
    )

    logger.info("Successfully deployed process group: %s", deployed_pg.id)
    return deployed_pg


def rename_process_group(deployed_pg: Any, new_name: str) -> Tuple[str, str]:
    """Rename deployed process group."""
    pg_id = deployed_pg.id if hasattr(deployed_pg, "id") else None
    pg_name = (
        deployed_pg.component.name
        if hasattr(deployed_pg, "component") and hasattr(deployed_pg.component, "name")
        else None
    )

    if new_name and pg_id:
        try:
            updated_pg = canvas.update_process_group(
                pg=deployed_pg, update={"name": new_name}
            )
            pg_name = updated_pg.component.name
            logger.info("Renamed process group to '%s'", pg_name)
        except Exception as rename_error:
            logger.warning("Could not rename process group: %s", rename_error)

    return pg_id, pg_name


def extract_deployed_version(deployed_pg: Any) -> Optional[int]:
    """Extract version from deployed process group."""
    if hasattr(deployed_pg, "component") and hasattr(
        deployed_pg.component, "version_control_information"
    ):
        vci = deployed_pg.component.version_control_information
        if vci and hasattr(vci, "version"):
            return vci.version
    return None
