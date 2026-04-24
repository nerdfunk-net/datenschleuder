"""Application service for NiFi hierarchy configuration."""

import json
import logging
import time
from typing import List

from repositories.nifi.hierarchy_repository import HierarchyValueRepository
from repositories.nifi.nifi_flow_repository import nifi_flow_repository as _flow_repo
from repositories.nifi.nifi_setting_repository import NifiSettingRepository

logger = logging.getLogger(__name__)

_value_repo = HierarchyValueRepository()
_setting_repo = NifiSettingRepository()

# In-memory TTL cache — hierarchy config rarely changes.
# Invalidated explicitly by save_hierarchy_config().
_hierarchy_cache: dict | None = None
_hierarchy_cache_time: float = 0.0
_HIERARCHY_CACHE_TTL: float = 60.0  # seconds

DEFAULT_HIERARCHY = [
    {"name": "CN", "label": "Common Name", "order": 0},
    {"name": "O", "label": "Organization", "order": 1},
    {"name": "OU", "label": "Organizational Unit", "order": 2},
    {"name": "DC", "label": "Domain Component", "order": 3},
]


def get_hierarchy_config() -> dict:
    """Get the current hierarchy configuration, cached for up to 60 seconds."""
    global _hierarchy_cache, _hierarchy_cache_time
    now = time.monotonic()
    if (
        _hierarchy_cache is not None
        and (now - _hierarchy_cache_time) < _HIERARCHY_CACHE_TTL
    ):
        return _hierarchy_cache

    setting = _setting_repo.get_by_key("hierarchy_config")
    if setting and setting.value:
        result = json.loads(setting.value)
    else:
        result = {"hierarchy": DEFAULT_HIERARCHY}
    _hierarchy_cache = result
    _hierarchy_cache_time = now
    return result


def invalidate_hierarchy_cache() -> None:
    """Invalidate the in-memory hierarchy config cache."""
    global _hierarchy_cache
    _hierarchy_cache = None


def get_flow_count() -> int:
    """Return the number of existing nifi_flows rows, or 0 if the table does not exist."""
    return _flow_repo.count()


def create_nifi_flows_table(hierarchy: list) -> dict:
    """Drop nifi_flows (if it exists) and recreate it with columns derived from hierarchy.

    Each hierarchy attribute contributes two columns: src_<name> and dest_<name>.
    Returns a summary dict with table_name, hierarchy_columns, and total_columns.
    """
    return _flow_repo.recreate_table(hierarchy)


def ensure_nifi_flows_table() -> None:
    """Create nifi_flows table from the current hierarchy config if it does not yet exist.

    Called at application startup so the table is always present before any request.
    """
    inspector = inspect(engine)
    if not inspector.has_table("nifi_flows"):
        config = get_hierarchy_config()
        hierarchy = config.get("hierarchy", DEFAULT_HIERARCHY)
        create_nifi_flows_table(hierarchy)
        logger.info("nifi_flows table created at startup from current hierarchy config")
    else:
        logger.debug("nifi_flows table already exists — skipping creation")


def save_hierarchy_config(hierarchy: list) -> int:
    """Drop and recreate nifi_flows from the new hierarchy, then persist the config.

    Returns the number of flow rows that existed before the table was dropped.
    """
    orders = [attr["order"] for attr in hierarchy]
    if sorted(orders) != list(range(len(orders))):
        raise ValueError("Order values must be sequential starting from 0")

    deleted_count = get_flow_count()
    create_nifi_flows_table(hierarchy)

    _setting_repo.upsert_json(
        key="hierarchy_config",
        value={"hierarchy": hierarchy},
        category="nifi",
        description="Hierarchical data format configuration",
    )
    invalidate_hierarchy_cache()
    return deleted_count


def get_attribute_values(attribute_name: str) -> List[str]:
    """Get all values for a specific attribute."""
    values = _value_repo.get_by_attribute(attribute_name)
    return [v.value for v in values]


def save_attribute_values(attribute_name: str, values: List[str]) -> int:
    """Replace all values for an attribute. Returns count saved."""
    return _value_repo.replace_attribute_values(attribute_name, values)


def delete_attribute_values(attribute_name: str) -> int:
    """Delete all values for a specific attribute. Returns count deleted."""
    return _value_repo.delete_by_attribute(attribute_name)


def get_deployment_settings() -> dict:
    """Get deployment settings."""
    global_setting = _setting_repo.get_by_key("deployment_config")
    global_settings = (
        json.loads(global_setting.value)
        if global_setting and global_setting.value
        else {
            "process_group_name_template": "{last_hierarchy_value}",
            "disable_after_deploy": False,
            "start_after_deploy": True,
            "stop_versioning_after_deploy": False,
        }
    )

    path_setting = _setting_repo.get_by_key("deployment_paths")
    path_settings = (
        json.loads(path_setting.value) if path_setting and path_setting.value else {}
    )

    return {"global": global_settings, "paths": path_settings}


def save_deployment_settings(data: dict) -> None:
    """Save deployment settings."""
    if "global" in data:
        _setting_repo.upsert_json(
            key="deployment_config",
            value=data["global"],
            category="nifi",
            description="Global deployment configuration",
        )

    if "paths" in data:
        _setting_repo.upsert_json(
            key="deployment_paths",
            value=data["paths"],
            category="nifi",
            description="Deployment path settings per instance",
        )
