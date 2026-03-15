"""
Service for Datenschleuder Agent management.
Handles Redis Pub/Sub communication and command tracking.
"""

import json
import logging
import time
import uuid
from typing import Dict, List, Optional

import redis
from sqlalchemy.orm import Session

from config import settings
from repositories.agent_repository import AgentRepository

logger = logging.getLogger(__name__)

# Redis key/channel name constants — must match datenschleuder_agent/config.py
_AGENT_REGISTRY_PREFIX = "agents:"
_COMMAND_CHANNEL_PREFIX = "datenschleuder-agent:"
_RESPONSE_CHANNEL_PREFIX = "datenschleuder-agent-response:"


class AgentService:
    """Manages Datenschleuder Agents via Redis Pub/Sub."""

    def __init__(self, db: Session):
        self.db = db
        self.repository = AgentRepository(db)
        self.redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )

    # ── Registry ────────────────────────────────────────────────────────────

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

    # ── Commands ─────────────────────────────────────────────────────────────

    def send_command(self, agent_id: str, command: str, params: dict, sent_by: str) -> str:
        """Publish a command to the agent channel. Returns the command_id."""
        command_id = str(uuid.uuid4())
        message = {
            "command_id": command_id,
            "command": command,
            "params": params,
            "timestamp": int(time.time()),
            "sender": "datenschleuder-backend",
        }

        self.repository.save_command(
            agent_id=agent_id,
            command_id=command_id,
            command=command,
            params=json.dumps(params),
            sent_by=sent_by,
        )

        try:
            self.redis_client.publish(
                f"{_COMMAND_CHANNEL_PREFIX}{agent_id}", json.dumps(message)
            )
            logger.info("Command sent to agent %s: %s (id=%s)", agent_id, command, command_id)
        except redis.RedisError as exc:
            logger.error("Failed to publish command to Redis: %s", exc)
            self.repository.update_command_result(
                command_id=command_id, status="error", error=f"Publish failed: {exc}"
            )
            raise

        return command_id

    def wait_for_response(self, agent_id: str, command_id: str, timeout: int = 30) -> dict:
        """Block until the agent responds or timeout elapses."""
        response_channel = f"{_RESPONSE_CHANNEL_PREFIX}{agent_id}"
        try:
            sub_client = redis.from_url(
                settings.redis_url, decode_responses=True, socket_timeout=timeout
            )
            pubsub = sub_client.pubsub()
            pubsub.subscribe(response_channel)

            start = time.time()
            for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    if data.get("command_id") == command_id:
                        self.repository.update_command_result(
                            command_id=command_id,
                            status=data.get("status"),
                            output=data.get("output"),
                            error=data.get("error"),
                            execution_time_ms=data.get("execution_time_ms"),
                        )
                        pubsub.unsubscribe()
                        pubsub.close()
                        sub_client.close()
                        return data
                except json.JSONDecodeError as exc:
                    logger.error("Invalid JSON in agent response: %s", exc)

                if time.time() - start > timeout:
                    break

            pubsub.unsubscribe()
            pubsub.close()
            sub_client.close()
            self.repository.update_command_result(
                command_id=command_id,
                status="timeout",
                error=f"No response after {timeout}s",
            )
            return {"command_id": command_id, "status": "timeout", "error": f"No response after {timeout}s"}

        except redis.RedisError as exc:
            logger.error("Redis error waiting for response: %s", exc)
            self.repository.update_command_result(
                command_id=command_id, status="error", error=str(exc)
            )
            raise

    # ── Convenience helpers ──────────────────────────────────────────────────

    def send_git_pull(self, agent_id: str, sent_by: str, timeout: int = 30) -> dict:
        if not self.check_agent_online(agent_id):
            return {"command_id": "", "status": "error", "error": "Agent is offline", "execution_time_ms": 0}
        command_id = self.send_command(agent_id, "git_pull", {}, sent_by)
        return self.wait_for_response(agent_id, command_id, timeout)

    def send_docker_restart(self, agent_id: str, sent_by: str, timeout: int = 60) -> dict:
        if not self.check_agent_online(agent_id):
            return {"command_id": "", "status": "error", "error": "Agent is offline", "execution_time_ms": 0}
        command_id = self.send_command(agent_id, "docker_restart", {}, sent_by)
        return self.wait_for_response(agent_id, command_id, timeout)

    # ── History ──────────────────────────────────────────────────────────────

    def get_command_history(self, agent_id: str, limit: int = 50):
        return self.repository.get_command_history(agent_id, limit)

    def get_all_command_history(self, limit: int = 100):
        return self.repository.get_all_command_history(limit)
