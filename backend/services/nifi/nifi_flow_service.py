"""Application service for NiFi flow management."""

import logging
from typing import List, Optional

from core.models import NifiFlow
from repositories.nifi.nifi_flow_repository import NifiFlowRepository
from services.nifi.hierarchy_service import get_hierarchy_config

logger = logging.getLogger(__name__)

_repo = NifiFlowRepository()


def list_flows() -> List[NifiFlow]:
    """List all NiFi flows."""
    return _repo.get_all_ordered()


def get_flow(flow_id: int) -> Optional[NifiFlow]:
    """Get a specific NiFi flow."""
    return _repo.get_by_id(flow_id)


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
) -> NifiFlow:
    """Create a new NiFi flow with hierarchy validation."""
    _validate_hierarchy_values(hierarchy_values)

    return _repo.create(
        hierarchy_values=hierarchy_values,
        name=name,
        contact=contact,
        src_connection_param=src_connection_param,
        dest_connection_param=dest_connection_param,
        src_template_id=src_template_id,
        dest_template_id=dest_template_id,
        active=active,
        description=description,
        creator_name=creator_name,
    )


def update_flow(flow_id: int, **kwargs) -> Optional[NifiFlow]:
    """Update a NiFi flow."""
    hierarchy_values = kwargs.get("hierarchy_values")
    if hierarchy_values is not None:
        _validate_hierarchy_values(hierarchy_values)

    return _repo.update(flow_id, **kwargs)


def delete_flow(flow_id: int) -> bool:
    """Delete a NiFi flow."""
    return _repo.delete(flow_id)


def copy_flow(flow_id: int) -> Optional[NifiFlow]:
    """Copy an existing NiFi flow."""
    original = _repo.get_by_id(flow_id)
    if not original:
        return None

    return _repo.create(
        hierarchy_values=original.hierarchy_values,
        name=original.name,
        contact=original.contact,
        src_connection_param=original.src_connection_param,
        dest_connection_param=original.dest_connection_param,
        src_template_id=original.src_template_id,
        dest_template_id=original.dest_template_id,
        active=False,
        description=original.description,
        creator_name=original.creator_name,
    )


def _validate_hierarchy_values(hierarchy_values: dict) -> None:
    """Validate hierarchy values against current config."""
    config = get_hierarchy_config()
    hierarchy_list = config.get("hierarchy", [])
    hierarchy_names = [attr["name"] for attr in hierarchy_list]

    for name in hierarchy_names:
        if name not in hierarchy_values:
            raise ValueError("Missing hierarchy value: %s" % name)

        if not isinstance(hierarchy_values[name], dict):
            raise ValueError(
                "Hierarchy value for %s must be a dict with 'source' and 'destination'"
                % name
            )

        if "source" not in hierarchy_values[name] or "destination" not in hierarchy_values[name]:
            raise ValueError(
                "Hierarchy value for %s must contain both 'source' and 'destination'"
                % name
            )
