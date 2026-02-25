"""Repository for registry flow metadata data access."""

from typing import List

from core.database import get_db_session
from core.models import RegistryFlowMetadata
from repositories.base import BaseRepository


class RegistryFlowMetadataRepository(BaseRepository[RegistryFlowMetadata]):
    """Repository for registry flow metadata CRUD operations."""

    def __init__(self):
        super().__init__(RegistryFlowMetadata)

    def get_by_flow_id(self, flow_id: int) -> List[RegistryFlowMetadata]:
        """Get all metadata entries for a specific registry flow."""
        db = get_db_session()
        try:
            return (
                db.query(RegistryFlowMetadata)
                .filter(RegistryFlowMetadata.registry_flow_id == flow_id)
                .order_by(RegistryFlowMetadata.id)
                .all()
            )
        finally:
            db.close()

    def delete_by_flow_id(self, flow_id: int) -> int:
        """Delete all metadata for a flow. Returns number of deleted rows."""
        db = get_db_session()
        try:
            count = (
                db.query(RegistryFlowMetadata)
                .filter(RegistryFlowMetadata.registry_flow_id == flow_id)
                .delete(synchronize_session=False)
            )
            db.commit()
            return count
        finally:
            db.close()

    def create_bulk(
        self, flow_id: int, items: List[dict]
    ) -> List[RegistryFlowMetadata]:
        """Create multiple metadata entries for a flow in one transaction."""
        db = get_db_session()
        try:
            entries = [
                RegistryFlowMetadata(
                    registry_flow_id=flow_id,
                    key=item["key"],
                    value=item["value"],
                    is_mandatory=item.get("is_mandatory", False),
                )
                for item in items
            ]
            db.add_all(entries)
            db.commit()
            for entry in entries:
                db.refresh(entry)
            return entries
        finally:
            db.close()
