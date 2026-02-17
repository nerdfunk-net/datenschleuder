"""Repository for flow view data access."""

from typing import Optional, List
from core.database import get_db_session
from core.models import FlowView
from repositories.base import BaseRepository


class FlowViewRepository(BaseRepository[FlowView]):
    """Repository for flow view CRUD operations."""

    def __init__(self):
        super().__init__(FlowView)

    def get_all_ordered(self) -> List[FlowView]:
        """Get all views ordered by default status and name."""
        db = get_db_session()
        try:
            return (
                db.query(FlowView)
                .order_by(FlowView.is_default.desc(), FlowView.name)
                .all()
            )
        finally:
            db.close()

    def get_default(self) -> Optional[FlowView]:
        """Get the default flow view."""
        db = get_db_session()
        try:
            return (
                db.query(FlowView)
                .filter(FlowView.is_default == True)  # noqa: E712
                .first()
            )
        finally:
            db.close()

    def set_default(self, view_id: int) -> Optional[FlowView]:
        """Set a view as default, unsetting all others."""
        db = get_db_session()
        try:
            db.query(FlowView).update({"is_default": False})
            view = db.query(FlowView).filter(FlowView.id == view_id).first()
            if view:
                view.is_default = True
                db.commit()
                db.refresh(view)
            return view
        finally:
            db.close()

    def get_by_name(self, name: str) -> Optional[FlowView]:
        """Get a view by name."""
        db = get_db_session()
        try:
            return db.query(FlowView).filter(FlowView.name == name).first()
        finally:
            db.close()
