"""
Service for Datenschleuder Agent management.
Handles Redis Pub/Sub communication and command tracking.
"""

import json
import logging
import time
import uuid
import re
from typing import Any, Dict, List, Optional

import redis
from sqlalchemy.orm import Session

from config import settings
from repositories.agent_repository import AgentRepository

logger = logging.getLogger(__name__)


_GIT_XY_LABELS: dict[str, str] = {
    "??": "untracked",
    " M": "modified",   "M ": "staged",       "MM": "staged+modified",
    " D": "deleted",    "D ": "staged deleted","A ": "added",        "AM": "added+modified",
    "R ": "renamed",    " R": "renamed",       "UU": "conflict",     "AA": "conflict",
    " A": "added",
}


def parse_git_status(raw: str) -> list[dict]:
    """Parse multi-repo git status --short --branch output into structured rows.

    The agent prefixes each repo block with [repo-id].  For repos with no
    changed files a synthetic {"status": "clean"} row is emitted so every
    repo is always represented in the output.
    """
    rows: list[dict] = []
    current_repo: str | None = None
    current_branch = ""
    repo_has_files = False

    for raw_line in raw.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue

        # ── Repo header ──────────────────────────────────────────────────────
        if line.startswith("[") and line.endswith("]"):
            if current_repo is not None and not repo_has_files:
                rows.append({"repo": current_repo, "branch": current_branch, "file": "", "status": "clean"})
            current_repo = line[1:-1]
            current_branch = ""
            repo_has_files = False
            continue

        if current_repo is None:
            continue

        # ── Branch info line: ## main...origin/main [ahead N] [behind N] ────
        if line.startswith("## "):
            info = line[3:]
            # handles "main...origin/main", "HEAD (no branch)", "No commits yet on main"
            current_branch = info.split("...")[0].split(" ")[0]
            continue

        # ── File status line: "XY filename" ──────────────────────────────────
        if len(line) >= 4 and line[2] == " ":
            xy = line[:2]
            filename = line[3:]
            status = _GIT_XY_LABELS.get(xy, xy.strip() or "modified")
            rows.append({"repo": current_repo, "branch": current_branch, "file": filename, "status": status})
            repo_has_files = True

    # flush last repo
    if current_repo is not None and not repo_has_files:
        rows.append({"repo": current_repo, "branch": current_branch, "file": "", "status": "clean"})

    return rows


def parse_list_repositories(raw: str) -> list[dict]:
    """Parse list_repositories JSON output into a list of row dicts."""
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        return [{"id": item["id"]} for item in parsed if isinstance(item, dict) and "id" in item]
    except (json.JSONDecodeError, KeyError):
        return []


def parse_list_containers(raw: str) -> list[dict]:
    """Parse list_containers JSON output into a list of row dicts."""
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        return [{"id": item["id"], "type": item.get("type", "")} for item in parsed if isinstance(item, dict) and "id" in item]
    except (json.JSONDecodeError, KeyError):
        return []


def parse_docker_ps(raw: str) -> list[dict]:
    """Parse `docker ps` tabular output into a list of row dicts."""
    lines = raw.strip().splitlines()
    if len(lines) < 2:
        return []
    columns = ["container_id", "image", "command", "created", "status", "ports", "names"]
    rows = []
    for line in lines[1:]:
        parts = re.split(r"\s{2,}", line.strip())
        # docker ps omits the ports column when empty
        while len(parts) < len(columns):
            parts.insert(-1, "")
        row = dict(zip(columns, parts))
        rows.append(row)
    return rows


def parse_docker_stats(raw: str) -> list[dict]:
    """Parse `docker stats --no-stream` tabular output into a list of row dicts."""
    lines = raw.strip().splitlines()
    if len(lines) < 2:
        return []
    rows = []
    for line in lines[1:]:
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 8:
            continue
        mem_parts = parts[3].split(" / ") if len(parts) > 3 else ["", ""]
        net_parts = parts[5].split(" / ") if len(parts) > 5 else ["", ""]
        block_parts = parts[6].split(" / ") if len(parts) > 6 else ["", ""]
        rows.append({
            "container_id": parts[0] if len(parts) > 0 else "",
            "name": parts[1] if len(parts) > 1 else "",
            "cpu_percent": parts[2] if len(parts) > 2 else "",
            "mem_usage": mem_parts[0] if len(mem_parts) > 0 else "",
            "mem_limit": mem_parts[1] if len(mem_parts) > 1 else "",
            "mem_percent": parts[4] if len(parts) > 4 else "",
            "net_io_rx": net_parts[0] if len(net_parts) > 0 else "",
            "net_io_tx": net_parts[1] if len(net_parts) > 1 else "",
            "block_io_read": block_parts[0] if len(block_parts) > 0 else "",
            "block_io_write": block_parts[1] if len(block_parts) > 1 else "",
            "pids": parts[7] if len(parts) > 7 else "",
        })
    return rows


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
                agent_id = key[len(_AGENT_REGISTRY_PREFIX) :]
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

    # ── Commands ─────────────────────────────────────────────────────────────

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

    # ── Convenience helpers ──────────────────────────────────────────────────

    def send_git_pull(self, agent_id: str, sent_by: str, timeout: int = 30) -> dict:
        if not self.check_agent_online(agent_id):
            return {
                "command_id": "",
                "status": "error",
                "error": "Agent is offline",
                "execution_time_ms": 0,
            }
        command_id = self.send_command(agent_id, "git_pull", {}, sent_by)
        return self.wait_for_response(agent_id, command_id, timeout)

    def send_command_and_wait(
        self,
        agent_id: str,
        command: str,
        params: dict,
        sent_by: str,
        timeout: int = 30,
    ) -> dict:
        """Subscribe first, then send — avoids missing fast responses via Pub/Sub race condition."""
        if not self.check_agent_online(agent_id):
            return {
                "command_id": "",
                "status": "error",
                "error": "Agent is offline",
                "execution_time_ms": 0,
            }

        response_channel = f"{_RESPONSE_CHANNEL_PREFIX}{agent_id}"

        # 1. Subscribe BEFORE publishing so we never miss a fast response.
        sub_client = redis.from_url(
            settings.redis_url,
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

        parsed: List[Dict[str, Any]] = []
        raw_output = result.get("output") or ""
        if command == "docker_ps":
            parsed = parse_docker_ps(raw_output)
        elif command == "docker_stats":
            parsed = parse_docker_stats(raw_output)
        elif command == "list_containers":
            parsed = parse_list_containers(raw_output)
        elif command == "list_repositories":
            parsed = parse_list_repositories(raw_output)
        elif command == "git_status":
            parsed = parse_git_status(raw_output)

        result["parsed_output"] = parsed if parsed else None
        return result

    def send_docker_restart(
        self, agent_id: str, sent_by: str, timeout: int = 60
    ) -> dict:
        if not self.check_agent_online(agent_id):
            return {
                "command_id": "",
                "status": "error",
                "error": "Agent is offline",
                "execution_time_ms": 0,
            }
        command_id = self.send_command(agent_id, "docker_restart", {}, sent_by)
        return self.wait_for_response(agent_id, command_id, timeout)

    # ── History ──────────────────────────────────────────────────────────────

    def get_command_history(self, agent_id: str, limit: int = 50):
        return self.repository.get_command_history(agent_id, limit)

    def get_all_command_history(self, limit: int = 100):
        return self.repository.get_all_command_history(limit)
