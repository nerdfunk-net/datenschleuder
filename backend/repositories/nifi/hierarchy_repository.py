"""Repository for hierarchy value data access."""

from typing import List
from core.database import get_db_session
from core.models import HierarchyValue
from repositories.base import BaseRepository


class HierarchyValueRepository(BaseRepository[HierarchyValue]):
    """Repository for hierarchy value CRUD operations."""

    def __init__(self):
        super().__init__(HierarchyValue)

    def get_by_attribute(self, attribute_name: str) -> List[HierarchyValue]:
        """Get all values for a specific attribute."""
        db = get_db_session()
        try:
            return (
                db.query(HierarchyValue)
                .filter(HierarchyValue.attribute_name == attribute_name)
                .all()
            )
        finally:
            db.close()

    def delete_by_attribute(self, attribute_name: str) -> int:
        """Delete all values for a specific attribute. Returns count deleted."""
        db = get_db_session()
        try:
            count = (
                db.query(HierarchyValue)
                .filter(HierarchyValue.attribute_name == attribute_name)
                .delete()
            )
            db.commit()
            return count
        finally:
            db.close()

    def replace_attribute_values(self, attribute_name: str, values: List[str]) -> int:
        """Replace all values for an attribute. Returns count created."""
        db = get_db_session()
        try:
            db.query(HierarchyValue).filter(
                HierarchyValue.attribute_name == attribute_name
            ).delete()

            count = 0
            for value in values:
                if value.strip():
                    db.add(
                        HierarchyValue(
                            attribute_name=attribute_name, value=value.strip()
                        )
                    )
                    count += 1

            db.commit()
            return count
        finally:
            db.close()
