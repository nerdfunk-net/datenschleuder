"""Agent history — DB-backed command history queries."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from repositories.agent_repository import AgentRepository


class AgentHistory:
    """Simple DB delegation for command history."""

    def __init__(self, repository: AgentRepository) -> None:
        self.repository = repository

    def get_command_history(self, agent_id: str, limit: int = 50):
        return self.repository.get_command_history(agent_id, limit)

    def get_all_command_history(self, limit: int = 100):
        return self.repository.get_all_command_history(limit)
