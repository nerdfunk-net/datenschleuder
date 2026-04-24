"""MultiRedisManager — one Redis client per configured server with fallback."""

from __future__ import annotations

import logging
from typing import List, Tuple

import redis

from config import settings
from repositories.settings.redis_repository import RedisServerRepository

logger = logging.getLogger(__name__)

_FALLBACK_SERVER_ID = 0
_FALLBACK_SERVER_NAME = "default"


class MultiRedisManager:
    """Loads all RedisServer rows from DB and creates one redis.Redis client per server.

    Falls back to settings.redis_url (synthetic server_id=0, name 'default') if no
    DB servers are configured — preserving backward compatibility.
    """

    def __init__(self) -> None:
        self._servers: List[
            Tuple[int, redis.Redis, str, str]
        ] = []  # (id, client, url, name)
        self._build()

    def _build(self) -> None:
        repo = RedisServerRepository()
        db_servers = repo.get_all_servers()

        if not db_servers:
            url = settings.redis_url
            client = redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
            )
            self._servers = [(_FALLBACK_SERVER_ID, client, url, _FALLBACK_SERVER_NAME)]
            logger.info(
                "MultiRedisManager: no DB servers, using settings.redis_url fallback"
            )
            return

        for server in db_servers:
            scheme = "rediss" if server.use_tls else "redis"
            if server.password:
                url = f"{scheme}://:{server.password}@{server.host}:{server.port}/{server.db_index}"
            else:
                url = f"{scheme}://{server.host}:{server.port}/{server.db_index}"
            try:
                client = redis.from_url(
                    url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_keepalive=True,
                )
                self._servers.append((server.id, client, url, server.name))
                logger.info(
                    "MultiRedisManager: initialized server '%s' (%s:%s)",
                    server.name,
                    server.host,
                    server.port,
                )
            except Exception as exc:
                logger.error(
                    "MultiRedisManager: failed to init server '%s': %s",
                    server.name,
                    exc,
                )

    def get_all(self) -> List[Tuple[int, redis.Redis, str, str]]:
        """Returns list of (server_id, client, redis_url, server_name) tuples."""
        return list(self._servers)

    def close_all(self) -> None:
        for _sid, client, _url, name in self._servers:
            try:
                client.close()
            except Exception as exc:
                logger.warning("MultiRedisManager: error closing '%s': %s", name, exc)
        self._servers.clear()
