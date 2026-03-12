"""Application service for NiFi flow management.

All database access is delegated to NifiFlowRepository which uses SQLAlchemy Core
table reflection so that the dynamically-structured nifi_flows schema (whose columns
are derived from the hierarchy config) is handled without raw SQL text() calls.
"""

import logging
import re
from typing import List, Optional

from sqlalchemy import inspect

from core.database import engine
from repositories.nifi.nifi_flow_repository import NifiFlowRepository
from repositories.nifi.nifi_cluster_repository import NifiClusterRepository
from services.nifi.hierarchy_service import get_hierarchy_config

logger = logging.getLogger(__name__)

# Module-level repository instance — shares the reflected table cache.
_repo = NifiFlowRepository(engine)


def invalidate_flow_table_cache() -> None:
    """Drop the cached reflected table so the next query re-reads the schema.

    Call this whenever the nifi_flows table is dropped and recreated (e.g. after
    saving a new hierarchy config).
    """
    _repo._invalidate_table_cache()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_STATIC_COLUMN_LABELS: dict = {
    "name": "Name",
    "contact": "Contact",
    "active": "Active",
    "src_connection_param": "Src Param Context",
    "dest_connection_param": "Dest Param Context",
    "src_template_id": "Src Template",
    "dest_template_id": "Dest Template",
    "description": "Description",
    "creator_name": "Creator",
    "created_at": "Created",
}

_INTERNAL_COLUMNS = {"id", "updated_at"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _table_exists() -> bool:
    return inspect(engine).has_table("nifi_flows")


def _get_hierarchy() -> list:
    config = get_hierarchy_config()
    return sorted(config.get("hierarchy", []), key=lambda x: x.get("order", 0))


def _build_flow_response(raw: dict, hierarchy: list) -> dict:
    """Convert a flat row dict (with src_*/dest_* columns) into an API-friendly dict
    with a nested hierarchy_values key."""
    hierarchy_values = {}
    for attr in hierarchy:
        name = attr["name"]
        name_lower = name.lower()
        hierarchy_values[name] = {
            "source": raw.pop(f"src_{name_lower}", ""),
            "destination": raw.pop(f"dest_{name_lower}", ""),
        }
    raw["hierarchy_values"] = hierarchy_values
    return raw


def _validate_hierarchy_values(hierarchy_values: dict, hierarchy: list) -> None:
    for attr in hierarchy:
        name = attr["name"]
        if name not in hierarchy_values:
            raise ValueError("Missing hierarchy value: %s" % name)
        if not isinstance(hierarchy_values[name], dict):
            raise ValueError(
                "Hierarchy value for %s must be a dict with 'source' and 'destination'"
                % name
            )
        if (
            "source" not in hierarchy_values[name]
            or "destination" not in hierarchy_values[name]
        ):
            raise ValueError(
                "Hierarchy value for %s must contain both 'source' and 'destination'"
                % name
            )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_flow_columns() -> list:
    """Return a list of {key, label} dicts for all visible nifi_flows columns.

    Hierarchy columns (src_*/dest_*) are labelled using the hierarchy config.
    Returns an empty list if the table does not yet exist.
    """
    if not _table_exists():
        return []

    hierarchy = _get_hierarchy()
    hierarchy_map = {attr["name"].lower(): attr for attr in hierarchy}

    raw_columns = [
        col_name
        for col_name in _repo.get_columns()
        if col_name not in _INTERNAL_COLUMNS
    ]

    result = []
    for col_name in raw_columns:
        if col_name.startswith("src_"):
            attr_lower = col_name[4:]
            if attr_lower in hierarchy_map:
                result.append(
                    {
                        "key": col_name,
                        "label": "Src " + hierarchy_map[attr_lower]["label"],
                    }
                )
        elif col_name.startswith("dest_"):
            attr_lower = col_name[5:]
            if attr_lower in hierarchy_map:
                result.append(
                    {
                        "key": col_name,
                        "label": "Dest " + hierarchy_map[attr_lower]["label"],
                    }
                )
        elif col_name in _STATIC_COLUMN_LABELS:
            result.append({"key": col_name, "label": _STATIC_COLUMN_LABELS[col_name]})

    return result


def list_flows() -> List[dict]:
    """List all NiFi flows ordered by creation date."""
    if not _table_exists():
        return []
    hierarchy = _get_hierarchy()
    rows = _repo.list_all()
    return [_build_flow_response(dict(row), hierarchy) for row in rows]


def get_flow(flow_id: int) -> Optional[dict]:
    """Get a specific NiFi flow by id."""
    if not _table_exists():
        return None
    hierarchy = _get_hierarchy()
    row = _repo.get_by_id(flow_id)
    if row is None:
        return None
    return _build_flow_response(dict(row), hierarchy)


def create_flow(
    hierarchy_values: dict,
    src_connection_param: str,
    dest_connection_param: str,
    name: Optional[str] = None,
    contact: Optional[str] = None,
    src_template_id: Optional[int] = None,
    dest_template_id: Optional[int] = None,
    active: bool = True,
    description: Optional[str] = None,
    creator_name: Optional[str] = None,
) -> dict:
    """Create a new NiFi flow with hierarchy validation."""
    if not _table_exists():
        raise ValueError(
            "NiFi flows table does not exist. Save the hierarchy settings first."
        )

    hierarchy = _get_hierarchy()
    _validate_hierarchy_values(hierarchy_values, hierarchy)

    values: dict = {}

    for attr in hierarchy:
        attr_name = attr["name"]
        attr_lower = attr_name.lower()
        values[f"src_{attr_lower}"] = hierarchy_values[attr_name]["source"]
        values[f"dest_{attr_lower}"] = hierarchy_values[attr_name]["destination"]

    for col, val in [
        ("name", name),
        ("contact", contact),
        ("src_connection_param", src_connection_param),
        ("dest_connection_param", dest_connection_param),
        ("src_template_id", src_template_id),
        ("dest_template_id", dest_template_id),
        ("active", active),
        ("description", description),
        ("creator_name", creator_name),
    ]:
        values[col] = val

    new_id = _repo.create(values)
    return get_flow(new_id)


def update_flow(flow_id: int, **kwargs) -> Optional[dict]:
    """Update a NiFi flow. Returns the updated flow or None if not found."""
    if not _table_exists():
        return None

    hierarchy = _get_hierarchy()
    hierarchy_values = kwargs.pop("hierarchy_values", None)

    update_values: dict = {}

    if hierarchy_values:
        _validate_hierarchy_values(hierarchy_values, hierarchy)
        for attr in hierarchy:
            attr_name = attr["name"]
            attr_lower = attr_name.lower()
            if attr_name in hierarchy_values:
                if "source" in hierarchy_values[attr_name]:
                    update_values[f"src_{attr_lower}"] = hierarchy_values[attr_name][
                        "source"
                    ]
                if "destination" in hierarchy_values[attr_name]:
                    update_values[f"dest_{attr_lower}"] = hierarchy_values[attr_name][
                        "destination"
                    ]

    for col in [
        "name",
        "contact",
        "src_connection_param",
        "dest_connection_param",
        "src_template_id",
        "dest_template_id",
        "active",
        "description",
    ]:
        if col in kwargs and kwargs[col] is not None:
            update_values[col] = kwargs[col]

    updated = _repo.update(flow_id, update_values)
    if not updated:
        return None
    return get_flow(flow_id)


def delete_flow(flow_id: int) -> bool:
    """Delete a NiFi flow. Returns True if deleted, False if not found."""
    if not _table_exists():
        return False
    return _repo.delete(flow_id)


def copy_flow(flow_id: int) -> Optional[dict]:
    """Copy an existing NiFi flow (copied flow starts as inactive)."""
    if not _table_exists():
        return None

    row = _repo.get_by_id(flow_id)
    if row is None:
        return None

    excluded = {"id", "created_at", "updated_at"}
    copy_values = {k: v for k, v in row.items() if k not in excluded}
    copy_values["active"] = False

    new_id = _repo.create(copy_values)
    return get_flow(new_id)


def get_flow_process_groups(flow_id: int) -> dict:
    """Find the source and destination process groups in NiFi for a given flow.

    Strategy:
    1. Load flow + ordered hierarchy config
    2. Resolve the configured source/destination parent PG path from deployment settings
    3. Find NiFi instance via cluster lookup (top hierarchy attr+value)
    4. Call get_all_process_group_paths() on each instance
    5. Build the expected full path = configured_parent + hierarchy[1..N] values
    6. Match by exact path comparison, return NiFi UI links
    """
    from services.nifi.operations import process_groups as pg_ops
    from services.nifi.nifi_context import nifi_connection_scope

    from services.nifi.hierarchy_service import get_deployment_settings

    flow = get_flow(flow_id)
    if flow is None:
        raise ValueError("Flow with id %d not found" % flow_id)

    hierarchy = _get_hierarchy()
    if not hierarchy:
        raise ValueError("No hierarchy configuration found")

    logger.debug("get_flow_process_groups: flow_id=%d hierarchy_values=%s", flow_id, flow.get("hierarchy_values"))

    # First hierarchy attribute + values → cluster lookup
    first_attr = hierarchy[0]["name"] if hierarchy else None
    first_src_val = flow.get("hierarchy_values", {}).get(first_attr, {}).get("source", "") if first_attr else ""
    first_dest_val = flow.get("hierarchy_values", {}).get(first_attr, {}).get("destination", "") if first_attr else ""

    logger.debug(
        "get_flow_process_groups: cluster lookup — first_attr=%r  first_src_val=%r  first_dest_val=%r",
        first_attr, first_src_val, first_dest_val,
    )

    cluster_repo = NifiClusterRepository()
    all_clusters = cluster_repo.get_all()

    logger.debug(
        "get_flow_process_groups: %d cluster(s) in DB: %s",
        len(all_clusters),
        [(c.hierarchy_attribute, c.hierarchy_value, c.id) for c in all_clusters],
    )

    def _find_cluster(attr_name, attr_value):
        for c in all_clusters:
            if c.hierarchy_attribute == attr_name and c.hierarchy_value == attr_value:
                return c
        return None

    src_cluster = _find_cluster(first_attr, first_src_val) if first_attr and first_src_val else None
    dest_cluster = _find_cluster(first_attr, first_dest_val) if first_attr and first_dest_val else None

    logger.debug(
        "get_flow_process_groups: src_cluster=%s  dest_cluster=%s",
        src_cluster.id if src_cluster else None,
        dest_cluster.id if dest_cluster else None,
    )

    def _get_instance(cluster):
        if cluster is None:
            return None
        return cluster_repo.get_primary_instance(cluster.id)

    src_instance = _get_instance(src_cluster)
    dest_instance = _get_instance(dest_cluster)

    logger.debug(
        "get_flow_process_groups: src_instance=%s (%s)  dest_instance=%s (%s)",
        src_instance.id if src_instance else None,
        src_instance.nifi_url if src_instance else None,
        dest_instance.id if dest_instance else None,
        dest_instance.nifi_url if dest_instance else None,
    )

    def _build_nifi_ui_url(instance):
        return re.sub(r"/nifi-api/?$", "", instance.nifi_url) + "/nifi"

    def _get_all_paths(instance):
        with nifi_connection_scope(instance, normalize_url=True):
            return pg_ops.get_all_process_group_paths()

    # Resolve the configured source/destination parent path for the instance.
    # The deployment settings store the parent PG where flows get deployed (e.g.
    # "NiFi Flow/From net1"). This already encodes the first hierarchy level
    # (DC), so we only append hierarchy levels 1..N from the flow's values.
    deployment_settings = get_deployment_settings()
    paths_config = deployment_settings.get("paths", {})

    def _resolve_configured_path(cluster, instance, path_type, all_paths_result):
        """Return the slash-separated NiFi path for the configured parent PG."""
        if cluster is None or instance is None:
            return None
        # paths_config is keyed by cluster ID (not instance ID)
        instance_paths = paths_config.get(str(cluster.id), {})
        path_config = instance_paths.get(path_type + "_path")
        if not path_config:
            logger.debug(
                "get_flow_process_groups: no %s_path configured for cluster %d (instance %d)",
                path_type, cluster.id, instance.id,
            )
            return None

        # Prefer resolving via stored PG id for accuracy
        stored_pg_id = path_config.get("id") if isinstance(path_config, dict) else None
        if stored_pg_id:
            pg_by_id = {pg["id"]: pg for pg in all_paths_result.get("process_groups", [])}
            pg = pg_by_id.get(stored_pg_id)
            if pg:
                logger.debug(
                    "get_flow_process_groups: resolved %s_path via id %s → %s",
                    path_type, stored_pg_id, pg["path"],
                )
                return pg["path"]

        # Fall back to stored path string (may use "→" display format, normalize it)
        raw = path_config.get("path", "") if isinstance(path_config, dict) else path_config
        normalized = "/".join(p.strip() for p in str(raw).replace("→", "/").split("/") if p.strip())
        logger.debug(
            "get_flow_process_groups: using stored %s_path string (normalized): %s",
            path_type, normalized,
        )
        return normalized

    def _build_full_path(configured_parent, flow_vals, path_type):
        """Append intermediate hierarchy levels (1..N, skipping first) to the parent path."""
        if not configured_parent:
            return None
        parts = [configured_parent]
        # Skip first hierarchy level (already encoded in configured_parent)
        for attr in hierarchy[1:]:
            name = attr["name"]
            side = "source" if path_type == "source" else "destination"
            val = flow_vals.get(name, {}).get(side, "")
            if val:
                parts.append(val)
        return "/".join(parts)

    flow_vals = flow.get("hierarchy_values", {})

    # Fetch all-paths, reusing result if src and dest share the same instance
    src_paths = None
    dest_paths = None

    if src_instance is not None:
        src_paths = _get_all_paths(src_instance)

    if dest_instance is not None:
        if src_instance is not None and dest_instance.id == src_instance.id:
            dest_paths = src_paths
        else:
            dest_paths = _get_all_paths(dest_instance)

    src_configured = _resolve_configured_path(src_cluster, src_instance, "source", src_paths or {})
    dest_configured = _resolve_configured_path(dest_cluster, dest_instance, "dest", dest_paths or {})

    src_full_path = _build_full_path(src_configured, flow_vals, "source")
    dest_full_path = _build_full_path(dest_configured, flow_vals, "dest")

    logger.debug(
        "get_flow_process_groups: src_full_path=%r  dest_full_path=%r",
        src_full_path, dest_full_path,
    )

    def _find_pg_by_path(all_paths_result, full_path):
        if not full_path or not all_paths_result:
            return None
        all_paths = [pg.get("path", "") for pg in all_paths_result.get("process_groups", [])]
        logger.debug(
            "get_flow_process_groups: looking for exact path %r among %d paths: %s",
            full_path, len(all_paths), all_paths,
        )
        full_path_lower = full_path.lower()
        for pg in all_paths_result.get("process_groups", []):
            if pg.get("path", "").lower() == full_path_lower:
                return pg
        return None

    src_pg = _find_pg_by_path(src_paths, src_full_path)
    dest_pg = _find_pg_by_path(dest_paths, dest_full_path)

    logger.debug("get_flow_process_groups: src_pg=%s  dest_pg=%s", src_pg, dest_pg)

    def _build_link_info(pg, instance):
        if pg is None or instance is None:
            return {"found": False}
        ui_url = _build_nifi_ui_url(instance)
        link = "%s/#/process-groups/%s" % (ui_url, pg["id"])
        logger.debug("get_flow_process_groups: built link %s  (pg path=%s)", link, pg["path"])
        return {
            "found": True,
            "process_group_id": pg["id"],
            "process_group_name": pg["name"],
            "path": pg["path"],
            "nifi_url": ui_url,
            "nifi_link": link,
            "instance_id": instance.id,
        }

    return {
        "status": "ok",
        "flow_id": flow_id,
        "source": _build_link_info(src_pg, src_instance),
        "destination": _build_link_info(dest_pg, dest_instance),
    }

