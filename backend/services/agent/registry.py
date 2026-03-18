"""Agent registry — read-only Redis operations for agent heartbeat status."""

import json
import logging
import time
from typing import Dict, List, Optional

import redis

logger = logging.getLogger(__name__)

_AGENT_REGISTRY_PREFIX = "agents:"


class AgentRegistry:
    """Read-only Redis operations for agent heartbeat status."""

    def __init__(self, redis_client: redis.Redis) -> None:
        self.redis_client = redis_client

    def get_agent_status(self, agent_id: str) -> Optional[Dict]:
        """Read agent heartbeat data from Redis. Returns None if not found."""
        try:
            data = self.redis_client.hgetall(f"{_AGENT_REGISTRY_PREFIX}{agent_id}")
            if not data:
                return None
            return {
                "agent_id": agent_id,
                "status": data.get("status", "offline"),
                "last_heartbeat": int(data.get("last_heartbeat", 0)),
                "version": data.get("version", ""),
                "hostname": data.get("agent_id", data.get("hostname", agent_id)),
                "capabilities": data.get("capabilities", ""),
                "started_at": int(data.get("started_at", 0)),
                "commands_executed": int(data.get("commands_executed", 0)),
            }
        except redis.RedisError as exc:
            logger.error("Failed to read agent status from Redis: %s", exc)
            raise

    def list_agents(self) -> List[Dict]:
        """List all agents by scanning the registry keys."""
        try:
            agents = []
            for key in self.redis_client.keys(f"{_AGENT_REGISTRY_PREFIX}*"):
                agent_id = key[len(_AGENT_REGISTRY_PREFIX):]
                status = self.get_agent_status(agent_id)
                if status:
                    agents.append(status)
            return agents
        except redis.RedisError as exc:
            logger.error("Failed to list agents from Redis: %s", exc)
            raise

    def check_agent_online(self, agent_id: str, max_age: int = 90) -> bool:
        """Return True if the agent's heartbeat is fresher than max_age seconds."""
        status = self.get_agent_status(agent_id)
        if not status or status["status"] != "online":
            return False
        return (int(time.time()) - status["last_heartbeat"]) < max_age

    def get_agent_containers(self, agent_id: str) -> List[Dict]:
        """Return the list of container IDs and types from the agent's Redis heartbeat data."""
        try:
            data = self.redis_client.hgetall(f"{_AGENT_REGISTRY_PREFIX}{agent_id}")
            if not data:
                return []
            raw = data.get("containers", "")
            if not raw:
                return []
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                return []
            return [
                {"id": item["id"], "type": item.get("type", "")}
                for item in parsed
                if isinstance(item, dict) and "id" in item
            ]
        except (json.JSONDecodeError, redis.RedisError) as exc:
            logger.warning("Could not read containers for agent %s: %s", agent_id, exc)
            return []

    def get_agent_repositories(self, agent_id: str) -> List[Dict]:
        """Return the list of repository IDs from the agent's Redis heartbeat data."""
        try:
            data = self.redis_client.hgetall(f"{_AGENT_REGISTRY_PREFIX}{agent_id}")
            if not data:
                return []
            raw = data.get("repositories", "")
            if not raw:
                return []
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                return []
            return [{"id": item["id"]} for item in parsed if isinstance(item, dict) and "id" in item]
        except (json.JSONDecodeError, redis.RedisError) as exc:
            logger.warning("Could not read repositories for agent %s: %s", agent_id, exc)
            return []
