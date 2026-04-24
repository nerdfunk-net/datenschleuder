"""Agent commands — Pub/Sub command execution with DB tracking."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import TYPE_CHECKING

import redis

from config import settings

if TYPE_CHECKING:
    from repositories.agent_repository import AgentRepository
    from services.agent.parsers import AgentCommandParser
    from services.agent.registry import AgentRegistry

logger = logging.getLogger(__name__)

_COMMAND_CHANNEL_PREFIX = "datenschleuder-agent:"
_RESPONSE_CHANNEL_PREFIX = "datenschleuder-agent-response:"


class AgentCommands:
    """Pub/Sub command execution with DB tracking."""

    def __init__(
        self,
        redis_client: redis.Redis,
        repository: AgentRepository,
        parser: AgentCommandParser,
        registry: AgentRegistry,
        redis_url: str = "",
    ) -> None:
        self.redis_client = redis_client
        self.repository = repository
        self.parser = parser
        self.registry = registry
        self.redis_url = redis_url or settings.redis_url
        self.server_id: int | None = None

    def send_command(
        self, agent_id: str, command: str, params: dict, sent_by: str
    ) -> str:
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
            redis_server_id=self.server_id,
        )

        try:
            self.redis_client.publish(
                f"{_COMMAND_CHANNEL_PREFIX}{agent_id}", json.dumps(message)
            )
            logger.info(
                "Command sent to agent %s: %s (id=%s)", agent_id, command, command_id
            )
        except redis.RedisError as exc:
            logger.error("Failed to publish command to Redis: %s", exc)
            self.repository.update_command_result(
                command_id=command_id, status="error", error=f"Publish failed: {exc}"
            )
            raise

        return command_id

    def wait_for_response(
        self, agent_id: str, command_id: str, timeout: int = 30
    ) -> dict:
        """Block until the agent responds or timeout elapses."""
        response_channel = f"{_RESPONSE_CHANNEL_PREFIX}{agent_id}"
        try:
            sub_client = redis.from_url(
                self.redis_url, decode_responses=True, socket_timeout=timeout
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
            return {
                "command_id": command_id,
                "status": "timeout",
                "error": f"No response after {timeout}s",
            }

        except redis.RedisError as exc:
            logger.error("Redis error waiting for response: %s", exc)
            self.repository.update_command_result(
                command_id=command_id, status="error", error=str(exc)
            )
            raise

    def send_command_and_wait(
        self,
        agent_id: str,
        command: str,
        params: dict,
        sent_by: str,
        timeout: int = 30,
    ) -> dict:
        """Subscribe first, then send — avoids missing fast responses via Pub/Sub race condition."""
        if not self.registry.check_agent_online(agent_id):
            return {
                "command_id": "",
                "status": "error",
                "error": "Agent is offline",
                "execution_time_ms": 0,
            }

        response_channel = f"{_RESPONSE_CHANNEL_PREFIX}{agent_id}"

        # 1. Subscribe BEFORE publishing so we never miss a fast response.
        sub_client = redis.from_url(
            self.redis_url,
            decode_responses=True,
            socket_timeout=timeout + 2,  # socket outlives the logical timeout
        )
        pubsub = sub_client.pubsub()
        pubsub.subscribe(response_channel)

        # 2. Now send the command (channel is already listening).
        command_id = self.send_command(agent_id, command, params, sent_by)

        # 3. Wait for the matching response.
        start = time.time()
        result = None
        try:
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
                        result = data
                        break
                except json.JSONDecodeError as exc:
                    logger.error("Invalid JSON in agent response: %s", exc)

                if time.time() - start > timeout:
                    break
        except redis.TimeoutError:
            logger.warning(
                "Socket timeout waiting for response from agent %s (command %s)",
                agent_id,
                command_id,
            )
        finally:
            pubsub.unsubscribe()
            pubsub.close()
            sub_client.close()

        if result is None:
            self.repository.update_command_result(
                command_id=command_id,
                status="timeout",
                error=f"No response after {timeout}s",
            )
            return {
                "command_id": command_id,
                "status": "timeout",
                "error": f"No response after {timeout}s",
                "execution_time_ms": int((time.time() - start) * 1000),
            }

        raw_output = result.get("output") or ""
        result["parsed_output"] = self.parser.parse(command, raw_output)
        return result

    def send_git_pull(self, agent_id: str, sent_by: str, timeout: int = 30) -> dict:
        if not self.registry.check_agent_online(agent_id):
            return {
                "command_id": "",
                "status": "error",
                "error": "Agent is offline",
                "execution_time_ms": 0,
            }
        command_id = self.send_command(agent_id, "git_pull", {}, sent_by)
        return self.wait_for_response(agent_id, command_id, timeout)

    def send_docker_restart(
        self, agent_id: str, sent_by: str, timeout: int = 60
    ) -> dict:
        if not self.registry.check_agent_online(agent_id):
            return {
                "command_id": "",
                "status": "error",
                "error": "Agent is offline",
                "execution_time_ms": 0,
            }
        command_id = self.send_command(agent_id, "docker_restart", {}, sent_by)
        return self.wait_for_response(agent_id, command_id, timeout)
