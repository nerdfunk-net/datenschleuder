"""NiFi version control operations - pure nipyapi logic."""

import logging
from typing import Optional

from nipyapi import versioning, canvas
from nipyapi.nifi import ProcessGroupsApi

logger = logging.getLogger(__name__)


def update_process_group_version(
    process_group_id: str, target_version: Optional[int] = None
) -> None:
    """Update a version-controlled process group to a new version."""
    pg_api = ProcessGroupsApi()
    pg = pg_api.get_process_group(id=process_group_id)
    versioning.update_flow_version(process_group=pg, target_version=target_version)
    logger.info(
        "Process group %s updated to version %s", process_group_id, target_version
    )


def stop_version_control(process_group_id: str) -> bool:
    """Stop version control for a process group. Returns True if was versioned."""
    pg = canvas.get_process_group(process_group_id, "id")

    if not pg:
        raise ValueError("Process group '%s' not found" % process_group_id)

    if not hasattr(pg, "component") or not hasattr(
        pg.component, "version_control_information"
    ):
        return False

    if not pg.component.version_control_information:
        return False

    versioning.stop_flow_ver(pg, refresh=True)
    logger.info("Version control stopped for process group %s", process_group_id)
    return True
