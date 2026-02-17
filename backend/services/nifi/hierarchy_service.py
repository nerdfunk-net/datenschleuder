"""Application service for NiFi hierarchy configuration."""

import json
import logging
from typing import List

from sqlalchemy import Table, Column, Integer, String, Boolean, DateTime, Text, MetaData, inspect, text
from sqlalchemy.sql import func

from core.models import Setting, HierarchyValue
from core.database import get_db_session, engine
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


def get_flow_count() -> int:
    """Return the number of existing nifi_flows rows, or 0 if the table does not exist."""
    inspector = inspect(engine)
    if not inspector.has_table("nifi_flows"):
        return 0
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM nifi_flows"))
        return result.scalar() or 0


def create_nifi_flows_table(hierarchy: list) -> dict:
    """Drop nifi_flows (if it exists) and recreate it with columns derived from hierarchy.

    Each hierarchy attribute contributes two columns: src_<name> and dest_<name>.
    Returns a summary dict with table_name, hierarchy_columns, and total_columns.
    """
    hierarchy = sorted(hierarchy, key=lambda x: x.get("order", 0))

    inspector = inspect(engine)
    if inspector.has_table("nifi_flows"):
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS nifi_flows"))
            conn.commit()

    metadata = MetaData()

    columns = [
        Column("id", Integer, primary_key=True, index=True),
    ]

    for attr in hierarchy:
        attr_name = attr["name"].lower()
        columns.append(Column(f"src_{attr_name}", String, nullable=False, index=True))
        columns.append(Column(f"dest_{attr_name}", String, nullable=False, index=True))

    columns.extend([
        Column("name", String, nullable=True),
        Column("contact", String, nullable=True),
        Column("src_connection_param", String, nullable=False),
        Column("dest_connection_param", String, nullable=False),
        Column("src_template_id", Integer, nullable=True),
        Column("dest_template_id", Integer, nullable=True),
        Column("active", Boolean, nullable=False, default=True),
        Column("description", Text, nullable=True),
        Column("creator_name", String, nullable=True),
        Column("created_at", DateTime(timezone=True), server_default=func.now()),
        Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()),
    ])

    Table("nifi_flows", metadata, *columns)
    metadata.create_all(engine)

    hierarchy_columns = [
        {
            "name": attr["name"],
            "src_column": f"src_{attr['name'].lower()}",
            "dest_column": f"dest_{attr['name'].lower()}",
        }
        for attr in hierarchy
    ]

    logger.info("Recreated nifi_flows table with %d hierarchy columns", len(hierarchy_columns))
    return {
        "table_name": "nifi_flows",
        "hierarchy_columns": hierarchy_columns,
        "total_columns": len(columns),
    }


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
