"""Repository for NiFi server data access."""

from typing import Optional, List
from core.database import get_db_session
from core.models import NifiServer
from repositories.base import BaseRepository


class NifiServerRepository(BaseRepository[NifiServer]):
    """Repository for NiFi server CRUD operations."""

    def __init__(self):
        super().__init__(NifiServer)

    def get_by_server_id(self, server_id: str) -> Optional[NifiServer]:
        """Get server by human-readable server_id."""
        db = get_db_session()
        try:
            return (
                db.query(NifiServer).filter(NifiServer.server_id == server_id).first()
            )
        finally:
            db.close()

    def get_all_ordered(self) -> List[NifiServer]:
        """Get all servers ordered by server_id."""
        db = get_db_session()
        try:
            return db.query(NifiServer).order_by(NifiServer.server_id).all()
        finally:
            db.close()
