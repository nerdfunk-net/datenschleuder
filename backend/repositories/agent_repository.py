"""
Repository for Datenschleuder Agent command history.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from core.models import DatenschleuderAgentCommand


class AgentRepository:
    """Handles persistence of agent command records."""

    def __init__(self, db: Session):
        self.db = db

    def save_command(
        self,
        agent_id: str,
        command_id: str,
        command: str,
        params: str,
        sent_by: str,
    ) -> DatenschleuderAgentCommand:
        record = DatenschleuderAgentCommand(
            agent_id=agent_id,
            command_id=command_id,
            command=command,
            params=params,
            status="pending",
            sent_at=datetime.utcnow(),
            sent_by=sent_by,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update_command_result(
        self,
        command_id: str,
        status: str,
        output: Optional[str] = None,
        error: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
    ) -> Optional[DatenschleuderAgentCommand]:
        record = (
            self.db.query(DatenschleuderAgentCommand)
            .filter(DatenschleuderAgentCommand.command_id == command_id)
            .first()
        )
        if not record:
            return None
        record.status = status
        record.output = output
        record.error = error
        record.execution_time_ms = execution_time_ms
        record.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_command_history(
        self, agent_id: str, limit: int = 50
    ) -> List[DatenschleuderAgentCommand]:
        return (
            self.db.query(DatenschleuderAgentCommand)
            .filter(DatenschleuderAgentCommand.agent_id == agent_id)
            .order_by(desc(DatenschleuderAgentCommand.sent_at))
            .limit(limit)
            .all()
        )

    def get_all_command_history(
        self, limit: int = 100
    ) -> List[DatenschleuderAgentCommand]:
        return (
            self.db.query(DatenschleuderAgentCommand)
            .order_by(desc(DatenschleuderAgentCommand.sent_at))
            .limit(limit)
            .all()
        )

    def count_commands(self, agent_id: Optional[str] = None) -> int:
        query = self.db.query(DatenschleuderAgentCommand)
        if agent_id:
            query = query.filter(DatenschleuderAgentCommand.agent_id == agent_id)
        return query.count()
