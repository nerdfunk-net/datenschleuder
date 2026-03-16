"""NiFi deployment sub-package.

Public API
----------
- ``NiFiDeploymentService`` — thin facade that delegates to focused sub-modules.
- ``find_or_create_process_group_by_path`` — resolve or create a PG path.
"""

import logging
from typing import Optional, Any, Tuple

from nipyapi import canvas

from services.nifi.deployment import registry, core, port_connections, version_control

logger = logging.getLogger(__name__)


class NiFiDeploymentService:
    """Thin facade over the deployment sub-modules.

    All heavy logic lives in the focused modules; this class merely delegates,
    preserving the public interface that ``deploy_service.py`` expects.
    """

    def __init__(self, last_hierarchy_attr: str = "cn") -> None:
        self.last_hierarchy_attr = last_hierarchy_attr

    # -- Registry ----------------------------------------------------------

    def get_bucket_and_flow_identifiers(
        self, bucket_id: str, flow_id: str, registry_client_id: str
    ) -> Tuple[str, str]:
        return registry.get_bucket_and_flow_identifiers(
            bucket_id, flow_id, registry_client_id
        )

    def get_deploy_version(
        self,
        requested_version: Optional[Any],
        reg_client_id: str,
        bucket_identifier: str,
        flow_identifier: str,
    ) -> Optional[int]:
        return registry.get_deploy_version(
            requested_version, reg_client_id, bucket_identifier, flow_identifier
        )

    # -- Core deploy -------------------------------------------------------

    def check_existing_process_group(
        self, process_group_name: Optional[str], parent_pg_id: str
    ) -> None:
        core.check_existing_process_group(process_group_name, parent_pg_id)

    def deploy_flow_version(
        self,
        parent_pg_id: str,
        bucket_identifier: str,
        flow_identifier: str,
        reg_client_id: str,
        deploy_version: Optional[int],
        x_position: int = 0,
        y_position: int = 0,
    ) -> Any:
        return core.deploy_flow_version(
            parent_pg_id,
            bucket_identifier,
            flow_identifier,
            reg_client_id,
            deploy_version,
            x_position,
            y_position,
        )

    def rename_process_group(self, deployed_pg: Any, new_name: str) -> Tuple[str, str]:
        return core.rename_process_group(deployed_pg, new_name)

    def extract_deployed_version(self, deployed_pg: Any) -> Optional[int]:
        return core.extract_deployed_version(deployed_pg)

    # -- Port connections --------------------------------------------------

    def auto_connect_ports(self, pg_id: str, parent_pg_id: str) -> None:
        port_connections.auto_connect_ports(
            pg_id, parent_pg_id, self.last_hierarchy_attr
        )

    # -- Version control / lifecycle ---------------------------------------

    def stop_version_control(self, pg_id: str) -> None:
        version_control.stop_version_control(pg_id)

    def start_process_group(self, pg_id: str) -> None:
        version_control.start_process_group(pg_id)

    def disable_process_group(self, pg_id: str) -> None:
        version_control.disable_process_group(pg_id)

    def assign_parameter_context(
        self, pg_id: str, parameter_context_name: Optional[str]
    ) -> None:
        version_control.assign_parameter_context(pg_id, parameter_context_name)


def find_or_create_process_group_by_path(path: str) -> str:
    """Find process group ID by path, creating missing parent process groups if needed."""
    logger.info("=" * 80)
    logger.info("FIND OR CREATE PROCESS GROUP BY PATH")
    logger.info("=" * 80)
    logger.info("Input path: '%s'", path)

    if not path or path == "/" or path == "":
        logger.info("Empty or root path provided, returning root PG ID")
        root_id = canvas.get_root_pg_id()
        logger.info("Root PG ID: %s", root_id)
        return root_id

    path_parts = [p.strip() for p in path.split("/") if p.strip()]
    logger.info("Path parts after split: %s", path_parts)

    if not path_parts:
        logger.info("No path parts after filtering, returning root PG ID")
        return canvas.get_root_pg_id()

    root_pg_id = canvas.get_root_pg_id()
    root_pg = canvas.get_process_group(root_pg_id, "id")
    root_pg_name = (
        root_pg.component.name
        if hasattr(root_pg, "component") and hasattr(root_pg.component, "name")
        else None
    )
    logger.info("Root PG: ID=%s, Name=%s", root_pg_id, root_pg_name)

    if root_pg_name and path_parts[0] == root_pg_name:
        logger.info("First path part matches root name, skipping it")
        path_parts = path_parts[1:]
        logger.info("Adjusted path parts: %s", path_parts)
        if not path_parts:
            logger.info("No parts remaining after root skip, returning root PG ID")
            return root_pg_id

    logger.info("Fetching all process groups from NiFi...")
    all_pgs = canvas.list_all_process_groups(root_pg_id)
    logger.info("Found %d process groups in NiFi", len(all_pgs))

    pg_map = {}
    for pg in all_pgs:
        pg_map[pg.id] = {
            "id": pg.id,
            "name": pg.component.name,
            "parent_group_id": pg.component.parent_group_id,
        }

    logger.info("Built pg_map with %d entries", len(pg_map))
    if len(pg_map) <= 10:
        for pg_id, pg_info in pg_map.items():
            logger.info(
                "  - PG: %s (parent: %s, name: '%s')",
                pg_id[:8],
                pg_info["parent_group_id"][:8]
                if pg_info["parent_group_id"]
                else "None",
                pg_info["name"],
            )

    def build_path_parts(pg_id):
        parts = []
        current_id = pg_id
        while current_id in pg_map and current_id != root_pg_id:
            pg_info = pg_map[current_id]
            parts.insert(0, pg_info["name"])
            current_id = pg_info["parent_group_id"]
        return parts

    logger.info("Searching for existing PG matching path: %s", path_parts)
    for pg_id, pg_info in pg_map.items():
        pg_path_parts = build_path_parts(pg_id)
        if pg_path_parts == path_parts:
            logger.info("✅ FOUND EXACT MATCH: PG ID=%s, Path=%s", pg_id, pg_path_parts)
            logger.info("=" * 80)
            return pg_id

    logger.info("No exact match found, will create missing PG hierarchy")
    current_parent_id = root_pg_id
    existing_depth = 0

    logger.info("Finding how much of the path already exists...")
    for i in range(len(path_parts)):
        partial_path = path_parts[: i + 1]
        found = False
        for pg_id, pg_info in pg_map.items():
            pg_path_parts = build_path_parts(pg_id)
            if pg_path_parts == partial_path:
                current_parent_id = pg_id
                existing_depth = i + 1
                found = True
                logger.info(
                    "  Partial path %s exists at depth %d (PG ID: %s)",
                    partial_path,
                    i + 1,
                    pg_id[:8],
                )
                break
        if not found:
            logger.info(
                "  Partial path %s does NOT exist, will create from here", partial_path
            )
            break

    logger.info("Existing hierarchy depth: %d of %d", existing_depth, len(path_parts))
    logger.info("Creating missing process groups from depth %d...", existing_depth)

    for i in range(existing_depth, len(path_parts)):
        pg_name = path_parts[i]
        logger.info(
            "  Creating PG '%s' under parent %s...", pg_name, current_parent_id[:8]
        )
        new_pg = canvas.create_process_group(
            parent_pg=canvas.get_process_group(current_parent_id, "id"),
            new_pg_name=pg_name,
            location=(0.0, 0.0),
        )
        current_parent_id = new_pg.id
        logger.info(
            "  ✅ Created process group '%s' (ID: %s)", pg_name, current_parent_id[:8]
        )

    logger.info("Final parent PG ID: %s", current_parent_id)
    logger.info("=" * 80)
    return current_parent_id
