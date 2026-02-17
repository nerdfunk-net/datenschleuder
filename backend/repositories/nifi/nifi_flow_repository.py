"""Repository for NiFi flow data access."""

from typing import List
from core.database import get_db_session
from core.models import NifiFlow
from repositories.base import BaseRepository


class NifiFlowRepository(BaseRepository[NifiFlow]):
    """Repository for NiFi flow CRUD operations."""

    def __init__(self):
        super().__init__(NifiFlow)

    def get_active(self) -> List[NifiFlow]:
        """Get all active flows."""
        db = get_db_session()
        try:
            return (
                db.query(NifiFlow)
                .filter(NifiFlow.active == True)  # noqa: E712
                .order_by(NifiFlow.created_at.desc())
                .all()
            )
        finally:
            db.close()

    def get_all_ordered(self) -> List[NifiFlow]:
        """Get all flows ordered by creation date."""
        db = get_db_session()
        try:
            return (
                db.query(NifiFlow)
                .order_by(NifiFlow.created_at.desc())
                .all()
            )
        finally:
            db.close()
