"""
Redis Server Repository - handles database operations for Redis server configurations.
"""

from typing import List, Optional
from core.models import RedisServer
from core.database import get_db_session
from repositories.base import BaseRepository
import logging

logger = logging.getLogger(__name__)


class RedisServerRepository(BaseRepository[RedisServer]):
    """Repository for Redis server configurations."""

    def __init__(self):
        super().__init__(RedisServer)

    def get_all_servers(self) -> List[RedisServer]:
        """Get all Redis servers ordered by name."""
        session = get_db_session()
        try:
            return session.query(RedisServer).order_by(RedisServer.name).all()
        finally:
            session.close()

    def get_by_name(self, name: str) -> Optional[RedisServer]:
        """Get a Redis server by name."""
        session = get_db_session()
        try:
            return session.query(RedisServer).filter(RedisServer.name == name).first()
        finally:
            session.close()
