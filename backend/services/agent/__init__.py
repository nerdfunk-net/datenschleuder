"""
Agent service package — Datenschleuder Agent management via Redis Pub/Sub.

The AgentService facade maintains backward compatibility with the former
monolithic agent_service.py. Internal consumers can import sub-modules directly:
    from services.agent.parsers import parse_git_status
    from services.agent.registry import AgentRegistry
"""

import logging
from sqlalchemy.orm import Session

from repositories.agent_repository import AgentRepository
from services.agent.parsers import AgentCommandParser
from services.agent.registry import AgentRegistry
from services.agent.commands import AgentCommands
from services.agent.history import AgentHistory
from services.agent.redis_manager import MultiRedisManager

# Re-export parsing functions for callers that import them directly
from services.agent.parsers import (  # noqa: F401
    parse_git_status,
    parse_list_repositories,
    parse_list_containers,
    parse_docker_ps,
    parse_docker_stats,
)

logger = logging.getLogger(__name__)


class AgentService:
    """Unified facade combining all agent operations.

    Delegates to:
    - AgentRegistry  — heartbeat status (Redis), one per Redis server
    - AgentCommands  — Pub/Sub command execution, one per Redis server
    - AgentHistory   — DB command history
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = AgentRepository(db)
        self._parser = AgentCommandParser()

        self._manager = MultiRedisManager()
        self._registries: dict[int, AgentRegistry] = {}
        self._commands_map: dict[int, AgentCommands] = {}
        self._server_names: dict[int, str] = {}

        for server_id, client, url, name in self._manager.get_all():
            self._server_names[server_id] = name
            registry = AgentRegistry(client)
            self._registries[server_id] = registry
            commands = AgentCommands(client, self.repository, self._parser, registry, url)
            commands.server_id = server_id
            self._commands_map[server_id] = commands

        self._history = AgentHistory(self.repository)

    # ── Internal routing ────────────────────────────────────────────────────

    def _find_server_for_agent(self, agent_id: str) -> int | None:
        """Scan all registries to find which server has the given agent."""
        for server_id, registry in self._registries.items():
            try:
                if registry.get_agent_status(agent_id) is not None:
                    return server_id
            except Exception as exc:
                logger.warning("Error checking agent %s on server %d: %s", agent_id, server_id, exc)
        return None

    def _get_commands(self, agent_id: str) -> AgentCommands:
        """Return the AgentCommands instance for the server hosting this agent.

        Falls back to the first available server if the agent is not found in any registry
        (the commands layer will surface the error naturally).
        """
        server_id = self._find_server_for_agent(agent_id)
        if server_id is not None:
            return self._commands_map[server_id]
        # Fallback: use first server
        return next(iter(self._commands_map.values()))

    def _get_registry(self, agent_id: str) -> AgentRegistry | None:
        server_id = self._find_server_for_agent(agent_id)
        if server_id is None:
            return None
        return self._registries[server_id]

    # ── Registry ────────────────────────────────────────────────────────────

    def list_agents(self) -> list[dict]:
        """Merge agents from all Redis servers, tagging each with server info."""
        seen: dict[str, dict] = {}
        for server_id, registry in self._registries.items():
            try:
                for agent in registry.list_agents():
                    aid = agent["agent_id"]
                    if aid not in seen:
                        agent["redis_server_id"] = server_id
                        agent["redis_server_name"] = self._server_names[server_id]
                        seen[aid] = agent
            except Exception as exc:
                logger.error("Failed to list agents from server %d: %s", server_id, exc)
        return list(seen.values())

    def get_agent_status(self, agent_id: str) -> dict | None:
        server_id = self._find_server_for_agent(agent_id)
        if server_id is None:
            return None
        status = self._registries[server_id].get_agent_status(agent_id)
        if status:
            status["redis_server_id"] = server_id
            status["redis_server_name"] = self._server_names[server_id]
        return status

    def check_agent_online(self, agent_id: str, max_age: int = 90) -> bool:
        registry = self._get_registry(agent_id)
        if registry is None:
            return False
        return registry.check_agent_online(agent_id, max_age)

    def get_agent_containers(self, agent_id: str):
        registry = self._get_registry(agent_id)
        if registry is None:
            return None
        return registry.get_agent_containers(agent_id)

    def get_agent_repositories(self, agent_id: str):
        registry = self._get_registry(agent_id)
        if registry is None:
            return None
        return registry.get_agent_repositories(agent_id)

    # ── Commands ─────────────────────────────────────────────────────────────

    def send_command(self, agent_id: str, command: str, params: dict, sent_by: str) -> str:
        return self._get_commands(agent_id).send_command(agent_id, command, params, sent_by)

    def wait_for_response(self, agent_id: str, command_id: str, timeout: int = 30) -> dict:
        return self._get_commands(agent_id).wait_for_response(agent_id, command_id, timeout)

    def send_command_and_wait(
        self, agent_id: str, command: str, params: dict, sent_by: str, timeout: int = 30
    ) -> dict:
        return self._get_commands(agent_id).send_command_and_wait(
            agent_id, command, params, sent_by, timeout
        )

    def send_git_pull(self, agent_id: str, sent_by: str, timeout: int = 30) -> dict:
        return self._get_commands(agent_id).send_git_pull(agent_id, sent_by, timeout)

    def send_docker_restart(self, agent_id: str, sent_by: str, timeout: int = 60) -> dict:
        return self._get_commands(agent_id).send_docker_restart(agent_id, sent_by, timeout)

    # ── History ──────────────────────────────────────────────────────────────

    def get_command_history(self, agent_id: str, limit: int = 50):
        return self._history.get_command_history(agent_id, limit)

    def get_all_command_history(self, limit: int = 100):
        return self._history.get_all_command_history(limit)
