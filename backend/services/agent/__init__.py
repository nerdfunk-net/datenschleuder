"""
Agent service package — Datenschleuder Agent management via Redis Pub/Sub.

The AgentService facade maintains backward compatibility with the former
monolithic agent_service.py. Internal consumers can import sub-modules directly:
    from services.agent.parsers import parse_git_status
    from services.agent.registry import AgentRegistry
"""

import redis
from sqlalchemy.orm import Session

from config import settings
from repositories.agent_repository import AgentRepository
from services.agent.parsers import AgentCommandParser
from services.agent.registry import AgentRegistry
from services.agent.commands import AgentCommands
from services.agent.history import AgentHistory

# Re-export parsing functions for callers that import them directly
from services.agent.parsers import (  # noqa: F401
    parse_git_status,
    parse_list_repositories,
    parse_list_containers,
    parse_docker_ps,
    parse_docker_stats,
)


class AgentService:
    """Unified facade combining all agent operations.

    Delegates to:
    - AgentRegistry  — heartbeat status (Redis)
    - AgentCommands  — Pub/Sub command execution
    - AgentHistory   — DB command history
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )
        self.repository = AgentRepository(db)

        self._registry = AgentRegistry(self.redis_client)
        self._commands = AgentCommands(
            self.redis_client,
            self.repository,
            AgentCommandParser(),
            self._registry,
        )
        self._history = AgentHistory(self.repository)

    # ── Registry ────────────────────────────────────────────────────────────

    def get_agent_status(self, agent_id: str):
        return self._registry.get_agent_status(agent_id)

    def list_agents(self):
        return self._registry.list_agents()

    def check_agent_online(self, agent_id: str, max_age: int = 90) -> bool:
        return self._registry.check_agent_online(agent_id, max_age)

    def get_agent_containers(self, agent_id: str):
        return self._registry.get_agent_containers(agent_id)

    def get_agent_repositories(self, agent_id: str):
        return self._registry.get_agent_repositories(agent_id)

    # ── Commands ─────────────────────────────────────────────────────────────

    def send_command(self, agent_id: str, command: str, params: dict, sent_by: str) -> str:
        return self._commands.send_command(agent_id, command, params, sent_by)

    def wait_for_response(self, agent_id: str, command_id: str, timeout: int = 30) -> dict:
        return self._commands.wait_for_response(agent_id, command_id, timeout)

    def send_command_and_wait(
        self, agent_id: str, command: str, params: dict, sent_by: str, timeout: int = 30
    ) -> dict:
        return self._commands.send_command_and_wait(agent_id, command, params, sent_by, timeout)

    def send_git_pull(self, agent_id: str, sent_by: str, timeout: int = 30) -> dict:
        return self._commands.send_git_pull(agent_id, sent_by, timeout)

    def send_docker_restart(self, agent_id: str, sent_by: str, timeout: int = 60) -> dict:
        return self._commands.send_docker_restart(agent_id, sent_by, timeout)

    # ── History ──────────────────────────────────────────────────────────────

    def get_command_history(self, agent_id: str, limit: int = 50):
        return self._history.get_command_history(agent_id, limit)

    def get_all_command_history(self, limit: int = 100):
        return self._history.get_all_command_history(limit)
