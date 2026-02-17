"""Repository for registry flow data access."""

from typing import Optional, List
from core.database import get_db_session
from core.models import RegistryFlow
from repositories.base import BaseRepository


class RegistryFlowRepository(BaseRepository[RegistryFlow]):
    """Repository for registry flow CRUD operations."""

    def __init__(self):
        super().__init__(RegistryFlow)

    def get_by_instance(self, instance_id: int) -> List[RegistryFlow]:
        """Get all flows for a specific NiFi instance."""
        db = get_db_session()
        try:
            return (
                db.query(RegistryFlow)
                .filter(RegistryFlow.nifi_instance_id == instance_id)
                .order_by(RegistryFlow.bucket_name, RegistryFlow.flow_name)
                .all()
            )
        finally:
            db.close()

    def get_by_flow_id(
        self, instance_id: int, bucket_id: str, flow_id: str
    ) -> Optional[RegistryFlow]:
        """Get a specific flow by instance, bucket, and flow IDs."""
        db = get_db_session()
        try:
            return (
                db.query(RegistryFlow)
                .filter(
                    RegistryFlow.nifi_instance_id == instance_id,
                    RegistryFlow.bucket_id == bucket_id,
                    RegistryFlow.flow_id == flow_id,
                )
                .first()
            )
        finally:
            db.close()

    def get_all_ordered(self) -> List[RegistryFlow]:
        """Get all flows ordered by instance, bucket, flow name."""
        db = get_db_session()
        try:
            return (
                db.query(RegistryFlow)
                .order_by(
                    RegistryFlow.nifi_instance_name,
                    RegistryFlow.bucket_name,
                    RegistryFlow.flow_name,
                )
                .all()
            )
        finally:
            db.close()
