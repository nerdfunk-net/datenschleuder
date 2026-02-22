"""NiFi install service - check and validate process group paths."""

import logging
from typing import List, Literal, Dict, Any, Set

from sqlalchemy import inspect, text

from core.database import engine
from services.nifi import instance_service, hierarchy_service
from services.nifi.connection import nifi_connection_service

logger = logging.getLogger(__name__)

# Suppress verbose nipyapi HTTP debug logs
logging.getLogger("nipyapi").setLevel(logging.WARNING)
logging.getLogger("nipyapi.nifi.rest").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_flows_raw() -> List[Dict[str, Any]]:
    """Get all flows from nifi_flows table as flat dicts."""
    if not inspect(engine).has_table("nifi_flows"):
        return []
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM nifi_flows"))
        rows = result.fetchall()
        keys = list(result.keys())
    return [dict(zip(keys, row)) for row in rows]


def _build_pg_by_path(all_pgs_raw: list) -> tuple:
    """Build lookup structures for process groups.

    Returns:
        Tuple of:
        - pg_by_path: path string -> pg info
        - pg_id_to_path: pg id -> full path string
    """
    pg_map: Dict[str, Dict[str, Any]] = {}
    for pg in all_pgs_raw:
        pg_map[pg.id] = {
            "id": pg.id,
            "name": pg.component.name,
            "parent_group_id": pg.component.parent_group_id,
        }

    logger.debug(
        "Raw process groups from NiFi API (%d total): %s",
        len(pg_map),
        [(info["name"], info["parent_group_id"]) for info in pg_map.values()],
    )

    def build_path_parts(pg_id: str) -> List[str]:
        parts: List[str] = []
        current_id = pg_id
        while current_id in pg_map:
            pg_info = pg_map[current_id]
            parts.insert(0, pg_info["name"])
            current_id = pg_info["parent_group_id"]
        return parts

    pg_by_path: Dict[str, Dict[str, Any]] = {}
    pg_id_to_path: Dict[str, str] = {}
    for pg_id, pg_info in pg_map.items():
        parts = build_path_parts(pg_id)
        path_str = "/".join(parts)
        pg_by_path[path_str] = pg_info
        pg_id_to_path[pg_id] = path_str

    logger.debug(
        "Built %d process group paths: %s",
        len(pg_by_path),
        sorted(pg_by_path.keys()),
    )

    return pg_by_path, pg_id_to_path


def _build_expected_paths(
    flows: List[Dict[str, Any]],
    configured_path: str,
    hierarchy: List[Dict[str, Any]],
    path_type: Literal["source", "destination"],
) -> Set[str]:
    """Build all process group paths that should exist for the given flows.

    Combines the configured base path with hierarchy values from each flow,
    excluding the first and last hierarchy levels.
    """
    configured_parts = [p.strip() for p in configured_path.split("/") if p.strip()]
    column_prefix = "src_" if path_type == "source" else "dest_"

    paths: Set[str] = set()

    for flow in flows:
        components = configured_parts.copy()

        # Add intermediate hierarchy levels (skip first and last)
        for level in hierarchy[1:-1]:
            attr_name = level.get("name", "")
            col = "%s%s" % (column_prefix, attr_name.lower())
            value = flow.get(col)
            if value:
                components.append(value)

        # Add all intermediate paths (cumulative)
        for i in range(1, len(components) + 1):
            paths.add("/".join(components[:i]))

    return paths


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def check_path(
    instance_id: int,
    path_type: Literal["source", "destination"],
) -> List[Dict[str, Any]]:
    """Check which process group paths exist for all managed flows.

    Args:
        instance_id: NiFi instance ID to connect to.
        path_type: Whether to check source or destination paths.

    Returns:
        List of {"path": str, "exists": bool} dicts sorted by path.

    Raises:
        ValueError: If instance not found or path not configured.
    """
    from nipyapi import canvas

    instance = instance_service.get_instance(instance_id)
    if not instance:
        raise ValueError("NiFi instance with ID %d not found" % instance_id)

    nifi_connection_service.configure_from_instance(instance)

    # Fetch all process groups from NiFi
    root_pg_id = canvas.get_root_pg_id()
    all_pgs_raw = canvas.list_all_process_groups(root_pg_id) or []
    pg_by_path, pg_id_to_path = _build_pg_by_path(all_pgs_raw)

    logger.info(
        "Found %d process groups in NiFi instance %d", len(pg_by_path), instance_id
    )

    # Load flows and configuration
    flows = _get_flows_raw()
    logger.info("Found %d flows in database", len(flows))

    deployment_settings = hierarchy_service.get_deployment_settings()
    paths_config = deployment_settings.get("paths", {})
    instance_paths = paths_config.get(str(instance_id), {})

    path_key = "source_path" if path_type == "source" else "dest_path"
    path_config = instance_paths.get(path_key)

    if not path_config:
        raise ValueError("No %s path configured for this instance." % path_type)

    # Resolve the configured path from the stored PG id (authoritative) or fall back
    # to the stored path string. The stored path may use a display format ("→") that
    # does not match the slash-separated NiFi paths, so prefer the id lookup.
    stored_pg_id = path_config.get("id") if isinstance(path_config, dict) else None
    if stored_pg_id and stored_pg_id in pg_id_to_path:
        configured_path = pg_id_to_path[stored_pg_id]
        logger.debug(
            "Resolved configured %s path via PG id '%s' → '%s'",
            path_type,
            stored_pg_id,
            configured_path,
        )
    else:
        configured_path = (
            path_config.get("path", "")
            if isinstance(path_config, dict)
            else path_config
        )
        logger.debug(
            "Using stored %s path string (no id match): '%s'",
            path_type,
            configured_path,
        )

    if not configured_path:
        raise ValueError("Invalid %s path configuration for this instance." % path_type)

    hierarchy_config = hierarchy_service.get_hierarchy_config()
    hierarchy = sorted(
        hierarchy_config.get("hierarchy", []),
        key=lambda x: x.get("order", 0),
    )

    expected_paths = _build_expected_paths(flows, configured_path, hierarchy, path_type)
    logger.info(
        "Expecting %d process group paths for %s", len(expected_paths), path_type
    )
    logger.debug("Expected paths: %s", sorted(expected_paths))
    logger.debug("Available NiFi paths: %s", sorted(pg_by_path.keys()))

    result = []
    for path in sorted(expected_paths):
        exists = path in pg_by_path
        if not exists:
            logger.debug(
                "Path '%s' NOT found. Available paths starting with same prefix: %s",
                path,
                [p for p in pg_by_path.keys() if path.split("/")[0] in p][:10],
            )
        result.append({"path": path, "exists": exists})

    return result
