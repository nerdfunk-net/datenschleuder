"""Application service for flow view management."""

import logging
from typing import List, Optional

from core.models import FlowView
from repositories.nifi.flow_view_repository import FlowViewRepository

logger = logging.getLogger(__name__)

_repo = FlowViewRepository()


def list_views() -> List[FlowView]:
    """Get all flow views."""
    return _repo.get_all_ordered()


def get_view(view_id: int) -> Optional[FlowView]:
    """Get a specific flow view."""
    return _repo.get_by_id(view_id)


def create_view(
    name: str,
    visible_columns: list,
    description: Optional[str] = None,
    column_widths: Optional[dict] = None,
    is_default: bool = False,
    created_by: Optional[str] = None,
) -> FlowView:
    """Create a new flow view."""
    existing = _repo.get_by_name(name)
    if existing:
        raise ValueError("View with name '%s' already exists" % name)

    if is_default:
        _unset_all_defaults()

    return _repo.create(
        name=name,
        description=description,
        visible_columns=visible_columns,
        column_widths=column_widths,
        is_default=is_default,
        created_by=created_by,
    )


def update_view(view_id: int, **kwargs) -> Optional[FlowView]:
    """Update a flow view."""
    name = kwargs.get("name")
    if name is not None:
        existing = _repo.get_by_name(name)
        if existing and existing.id != view_id:
            raise ValueError("View with name '%s' already exists" % name)

    is_default = kwargs.get("is_default")
    if is_default:
        _unset_all_defaults_except(view_id)

    return _repo.update(view_id, **kwargs)


def delete_view(view_id: int) -> bool:
    """Delete a flow view."""
    return _repo.delete(view_id)


def set_default(view_id: int) -> Optional[FlowView]:
    """Set a view as the default."""
    return _repo.set_default(view_id)


def _unset_all_defaults():
    """Unset all default views."""
    from core.database import get_db_session
    db = get_db_session()
    try:
        db.query(FlowView).update({"is_default": False})
        db.commit()
    finally:
        db.close()


def _unset_all_defaults_except(view_id: int):
    """Unset all default views except the specified one."""
    from core.database import get_db_session
    db = get_db_session()
    try:
        db.query(FlowView).filter(FlowView.id != view_id).update({"is_default": False})
        db.commit()
    finally:
        db.close()
