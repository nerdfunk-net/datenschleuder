"""Application service for NiFi flow management.

Uses raw SQL against the dynamically-structured nifi_flows table whose columns
are derived from the hierarchy configuration.  The ORM-based NifiFlowRepository
is no longer used here because the table schema is not fixed at model time.
"""

import logging
from typing import List, Optional

from sqlalchemy import inspect, text

from core.database import engine
from services.nifi.hierarchy_service import get_hierarchy_config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
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
                "Hierarchy value for %s must be a dict with 'source' and 'destination'" % name
            )
        if "source" not in hierarchy_values[name] or "destination" not in hierarchy_values[name]:
            raise ValueError(
                "Hierarchy value for %s must contain both 'source' and 'destination'" % name
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
        col["name"]
        for col in inspect(engine).get_columns("nifi_flows")
        if col["name"] not in _INTERNAL_COLUMNS
    ]

    result = []
    for col_name in raw_columns:
        if col_name.startswith("src_"):
            attr_lower = col_name[4:]
            if attr_lower in hierarchy_map:
                result.append({"key": col_name, "label": "Src " + hierarchy_map[attr_lower]["label"]})
        elif col_name.startswith("dest_"):
            attr_lower = col_name[5:]
            if attr_lower in hierarchy_map:
                result.append({"key": col_name, "label": "Dest " + hierarchy_map[attr_lower]["label"]})
        elif col_name in _STATIC_COLUMN_LABELS:
            result.append({"key": col_name, "label": _STATIC_COLUMN_LABELS[col_name]})

    return result


def list_flows() -> List[dict]:
    """List all NiFi flows ordered by creation date."""
    if not _table_exists():
        return []
    hierarchy = _get_hierarchy()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM nifi_flows ORDER BY created_at DESC"))
        rows = result.fetchall()
        keys = list(result.keys())
    return [_build_flow_response(dict(zip(keys, row)), hierarchy) for row in rows]


def get_flow(flow_id: int) -> Optional[dict]:
    """Get a specific NiFi flow by id."""
    if not _table_exists():
        return None
    hierarchy = _get_hierarchy()
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT * FROM nifi_flows WHERE id = :id"), {"id": flow_id}
        )
        row = result.fetchone()
        if not row:
            return None
        keys = list(result.keys())
    return _build_flow_response(dict(zip(keys, row)), hierarchy)


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

    columns = []
    values = {}

    for attr in hierarchy:
        attr_name = attr["name"]
        attr_lower = attr_name.lower()
        columns.append(f"src_{attr_lower}")
        columns.append(f"dest_{attr_lower}")
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
        columns.append(col)
        values[col] = val

    cols_str = ", ".join(columns)
    placeholders = ", ".join([f":{c}" for c in columns])

    with engine.connect() as conn:
        result = conn.execute(
            text(f"INSERT INTO nifi_flows ({cols_str}) VALUES ({placeholders}) RETURNING id"),
            values,
        )
        conn.commit()
        new_id = result.fetchone()[0]

    return get_flow(new_id)


def update_flow(flow_id: int, **kwargs) -> Optional[dict]:
    """Update a NiFi flow. Returns the updated flow or None if not found."""
    if not _table_exists():
        return None

    hierarchy = _get_hierarchy()
    hierarchy_values = kwargs.pop("hierarchy_values", None)

    update_parts = []
    values = {"flow_id": flow_id}

    if hierarchy_values:
        _validate_hierarchy_values(hierarchy_values, hierarchy)
        for attr in hierarchy:
            attr_name = attr["name"]
            attr_lower = attr_name.lower()
            if attr_name in hierarchy_values:
                if "source" in hierarchy_values[attr_name]:
                    update_parts.append(f"src_{attr_lower} = :src_{attr_lower}")
                    values[f"src_{attr_lower}"] = hierarchy_values[attr_name]["source"]
                if "destination" in hierarchy_values[attr_name]:
                    update_parts.append(f"dest_{attr_lower} = :dest_{attr_lower}")
                    values[f"dest_{attr_lower}"] = hierarchy_values[attr_name]["destination"]

    for col in [
        "name", "contact", "src_connection_param", "dest_connection_param",
        "src_template_id", "dest_template_id", "active", "description",
    ]:
        if col in kwargs and kwargs[col] is not None:
            update_parts.append(f"{col} = :{col}")
            values[col] = kwargs[col]

    update_parts.append("updated_at = CURRENT_TIMESTAMP")

    with engine.connect() as conn:
        result = conn.execute(
            text(f"UPDATE nifi_flows SET {', '.join(update_parts)} WHERE id = :flow_id"),
            values,
        )
        conn.commit()
        if result.rowcount == 0:
            return None

    return get_flow(flow_id)


def delete_flow(flow_id: int) -> bool:
    """Delete a NiFi flow. Returns True if deleted, False if not found."""
    if not _table_exists():
        return False
    with engine.connect() as conn:
        result = conn.execute(
            text("DELETE FROM nifi_flows WHERE id = :id"), {"id": flow_id}
        )
        conn.commit()
        return result.rowcount > 0


def copy_flow(flow_id: int) -> Optional[dict]:
    """Copy an existing NiFi flow (copied flow starts as inactive)."""
    if not _table_exists():
        return None

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT * FROM nifi_flows WHERE id = :id"), {"id": flow_id}
        )
        row = result.fetchone()
        if not row:
            return None
        keys = list(result.keys())

    values_dict = dict(zip(keys, row))
    excluded = {"id", "created_at", "updated_at"}
    columns_to_copy = [k for k in keys if k not in excluded]
    copy_values = {c: values_dict[c] for c in columns_to_copy}
    copy_values["active"] = False

    cols_str = ", ".join(columns_to_copy)
    placeholders = ", ".join([f":{c}" for c in columns_to_copy])

    with engine.connect() as conn:
        result = conn.execute(
            text(f"INSERT INTO nifi_flows ({cols_str}) VALUES ({placeholders}) RETURNING id"),
            copy_values,
        )
        conn.commit()
        new_id = result.fetchone()[0]

    return get_flow(new_id)
