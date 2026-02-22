"""Repository for NiFi instance data access."""

from typing import Optional, List
from core.database import get_db_session
from core.models import NifiInstance
from repositories.base import BaseRepository


class NifiInstanceRepository(BaseRepository[NifiInstance]):
    """Repository for NiFi instance CRUD operations."""

    def __init__(self):
        super().__init__(NifiInstance)

    def get_by_hierarchy(self, attribute: str, value: str) -> Optional[NifiInstance]:
        """Get instance by hierarchy attribute and value."""
        db = get_db_session()
        try:
            return (
                db.query(NifiInstance)
                .filter(
                    NifiInstance.hierarchy_attribute == attribute,
                    NifiInstance.hierarchy_value == value,
                )
                .first()
            )
        finally:
            db.close()

    def get_by_name(self, name: str) -> Optional[NifiInstance]:
        """Get instance by name."""
        db = get_db_session()
        try:
            return db.query(NifiInstance).filter(NifiInstance.name == name).first()
        finally:
            db.close()

    def get_all_ordered(self) -> List[NifiInstance]:
        """Get all instances ordered by hierarchy."""
        db = get_db_session()
        try:
            return (
                db.query(NifiInstance)
                .order_by(
                    NifiInstance.hierarchy_attribute, NifiInstance.hierarchy_value
                )
                .all()
            )
        finally:
            db.close()
