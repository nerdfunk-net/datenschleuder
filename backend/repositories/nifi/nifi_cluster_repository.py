"""Repository for NiFi cluster data access."""

from typing import Optional, List
from core.database import get_db_session
from core.models import NifiCluster, NifiClusterInstance
from repositories.base import BaseRepository


class NifiClusterRepository(BaseRepository[NifiCluster]):
    """Repository for NiFi cluster CRUD operations."""

    def __init__(self):
        super().__init__(NifiCluster)

    def get_by_cluster_id(self, cluster_id: str) -> Optional[NifiCluster]:
        """Get cluster by human-readable cluster_id."""
        db = get_db_session()
        try:
            return (
                db.query(NifiCluster)
                .filter(NifiCluster.cluster_id == cluster_id)
                .first()
            )
        finally:
            db.close()

    def get_all_with_members(self) -> List[NifiCluster]:
        """Get all clusters ordered by cluster_id (members loaded via relationship)."""
        db = get_db_session()
        try:
            clusters = db.query(NifiCluster).order_by(NifiCluster.cluster_id).all()
            # Eagerly load members and their instance data so they survive session close
            for cluster in clusters:
                for member in cluster.members:
                    _ = member.instance.nifi_url  # noqa: force load
            return clusters
        finally:
            db.close()

    def get_member_instance_ids(self, cluster_id: int) -> List[int]:
        """Get list of instance DB IDs belonging to a cluster."""
        db = get_db_session()
        try:
            rows = (
                db.query(NifiClusterInstance.instance_id)
                .filter(NifiClusterInstance.cluster_id == cluster_id)
                .all()
            )
            return [r[0] for r in rows]
        finally:
            db.close()

    def get_cluster_for_instance(self, instance_id: int) -> Optional[NifiClusterInstance]:
        """Return the NifiClusterInstance row for an instance if it's in any cluster."""
        db = get_db_session()
        try:
            return (
                db.query(NifiClusterInstance)
                .filter(NifiClusterInstance.instance_id == instance_id)
                .first()
            )
        finally:
            db.close()

    def get_primary_instance(self, cluster_db_id: int):
        """Return the primary NifiInstance ORM object for a cluster, or None."""
        from core.models import NifiClusterInstance, NifiInstance

        db = get_db_session()
        try:
            inst = (
                db.query(NifiInstance)
                .join(NifiClusterInstance, NifiClusterInstance.instance_id == NifiInstance.id)
                .filter(
                    NifiClusterInstance.cluster_id == cluster_db_id,
                    NifiClusterInstance.is_primary.is_(True),
                )
                .first()
            )
            if inst:
                # Force-load all scalar columns so they survive session close
                _ = inst.nifi_url
                _ = inst.name
                _ = inst.username
                _ = inst.use_ssl
                _ = inst.verify_ssl
                _ = inst.certificate_name
                _ = inst.check_hostname
                _ = inst.oidc_provider_id
            return inst
        finally:
            db.close()

    def set_members(self, cluster_id: int, members: List[dict]) -> None:
        """Replace all cluster members atomically.

        members: list of dicts with keys 'instance_id' (int) and 'is_primary' (bool).
        """
        db = get_db_session()
        try:
            # Remove existing members
            db.query(NifiClusterInstance).filter(
                NifiClusterInstance.cluster_id == cluster_id
            ).delete()

            # Add new members
            for m in members:
                row = NifiClusterInstance(
                    cluster_id=cluster_id,
                    instance_id=m["instance_id"],
                    is_primary=m["is_primary"],
                )
                db.add(row)

            db.commit()
        finally:
            db.close()
