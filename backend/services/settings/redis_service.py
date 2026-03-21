"""
Redis Server Service - business logic for Redis server configuration management.
"""

from typing import List, Optional, Dict, Any
from repositories.settings.redis_repository import RedisServerRepository
from models.settings import RedisServerCreate, RedisServerUpdate
import logging

logger = logging.getLogger(__name__)


def _to_safe_dict(server) -> Dict[str, Any]:
    """Convert a RedisServer model to a safe dict without the raw password."""
    return {
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "use_tls": server.use_tls,
        "db_index": server.db_index,
        "has_password": bool(server.password),
    }


class RedisService:
    """Service for managing Redis server configurations."""

    def __init__(self):
        self._repo = RedisServerRepository()

    def list_servers(self) -> List[Dict[str, Any]]:
        """Return all Redis servers as safe dicts."""
        servers = self._repo.get_all_servers()
        return [_to_safe_dict(s) for s in servers]

    def get_server(self, server_id: int) -> Optional[Dict[str, Any]]:
        """Return a single Redis server by ID, or None if not found."""
        server = self._repo.get_by_id(server_id)
        if server is None:
            return None
        return _to_safe_dict(server)

    def create_server(self, data: RedisServerCreate) -> Dict[str, Any]:
        """Create a new Redis server configuration."""
        server = self._repo.create(
            name=data.name,
            host=data.host,
            port=data.port,
            use_tls=data.use_tls,
            db_index=data.db_index,
            password=data.password or None,
        )
        return _to_safe_dict(server)

    def update_server(self, server_id: int, data: RedisServerUpdate) -> Optional[Dict[str, Any]]:
        """Update an existing Redis server. Empty string password clears it."""
        server = self._repo.get_by_id(server_id)
        if server is None:
            return None

        update_kwargs: Dict[str, Any] = {}
        if data.name is not None:
            update_kwargs["name"] = data.name
        if data.host is not None:
            update_kwargs["host"] = data.host
        if data.port is not None:
            update_kwargs["port"] = data.port
        if data.use_tls is not None:
            update_kwargs["use_tls"] = data.use_tls
        if data.db_index is not None:
            update_kwargs["db_index"] = data.db_index
        if data.password is not None:
            # Empty string → clear password; non-empty → set new password
            update_kwargs["password"] = data.password if data.password else None

        updated = self._repo.update(server_id, **update_kwargs)
        return _to_safe_dict(updated)

    def delete_server(self, server_id: int) -> bool:
        """Delete a Redis server by ID. Returns True if deleted, False if not found."""
        server = self._repo.get_by_id(server_id)
        if server is None:
            return False
        self._repo.delete(server_id)
        return True

    def test_connection(self, server_id: int) -> Dict[str, Any]:
        """Attempt a PING against the stored Redis server. Returns status dict."""
        import redis as redis_lib

        server = self._repo.get_by_id(server_id)
        if server is None:
            raise ValueError(f"Redis server {server_id} not found")

        client = redis_lib.Redis(
            host=server.host,
            port=server.port,
            db=server.db_index,
            password=server.password or None,
            ssl=server.use_tls,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        try:
            client.ping()
            return {"connected": True, "host": server.host, "port": server.port}
        except Exception as exc:
            raise ConnectionError(str(exc)) from exc
        finally:
            client.close()


redis_service = RedisService()
