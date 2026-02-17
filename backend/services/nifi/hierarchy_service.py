"""Application service for NiFi hierarchy configuration."""

import json
import logging
from typing import List, Optional

from core.models import Setting, HierarchyValue
from core.database import get_db_session
from repositories.nifi.hierarchy_repository import HierarchyValueRepository

logger = logging.getLogger(__name__)

_value_repo = HierarchyValueRepository()

DEFAULT_HIERARCHY = [
    {"name": "CN", "label": "Common Name", "order": 0},
    {"name": "O", "label": "Organization", "order": 1},
    {"name": "OU", "label": "Organizational Unit", "order": 2},
    {"name": "DC", "label": "Domain Component", "order": 3},
]


def get_hierarchy_config() -> dict:
    """Get the current hierarchy configuration."""
    db = get_db_session()
    try:
        setting = db.query(Setting).filter(Setting.key == "hierarchy_config").first()
        if setting and setting.value:
            return json.loads(setting.value)
        return {"hierarchy": DEFAULT_HIERARCHY}
    finally:
        db.close()


def save_hierarchy_config(hierarchy: list) -> None:
    """Save hierarchy configuration."""
    orders = [attr["order"] for attr in hierarchy]
    if sorted(orders) != list(range(len(orders))):
        raise ValueError("Order values must be sequential starting from 0")

    db = get_db_session()
    try:
        value_json = json.dumps({"hierarchy": hierarchy})
        setting = db.query(Setting).filter(Setting.key == "hierarchy_config").first()
        if setting:
            setting.value = value_json
        else:
            setting = Setting(
                key="hierarchy_config",
                value=value_json,
                category="nifi",
                value_type="json",
                description="Hierarchical data format configuration",
            )
            db.add(setting)
        db.commit()
    finally:
        db.close()


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
    db = get_db_session()
    try:
        global_setting = db.query(Setting).filter(Setting.key == "deployment_config").first()
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

        path_setting = db.query(Setting).filter(Setting.key == "deployment_paths").first()
        path_settings = (
            json.loads(path_setting.value)
            if path_setting and path_setting.value
            else {}
        )

        return {"global": global_settings, "paths": path_settings}
    finally:
        db.close()


def save_deployment_settings(data: dict) -> None:
    """Save deployment settings."""
    db = get_db_session()
    try:
        if "global" in data:
            _upsert_setting(
                db,
                key="deployment_config",
                value=data["global"],
                category="nifi",
                description="Global deployment configuration",
            )

        if "paths" in data:
            _upsert_setting(
                db,
                key="deployment_paths",
                value=data["paths"],
                category="nifi",
                description="Deployment path settings per instance",
            )

        db.commit()
    finally:
        db.close()


def _upsert_setting(db, key: str, value: dict, category: str, description: str):
    """Create or update a setting."""
    value_json = json.dumps(value)
    setting = db.query(Setting).filter(Setting.key == key).first()

    if setting:
        setting.value = value_json
    else:
        setting = Setting(
            key=key,
            value=value_json,
            category=category,
            value_type="json",
            description=description,
        )
        db.add(setting)
