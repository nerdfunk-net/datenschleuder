"""NiFi flow repository — SQLAlchemy Core Table with dynamic column reflection.

The nifi_flows table schema is not fixed at model time; its columns are derived
from the hierarchy configuration.  We reflect the live table once per instance
via autoload_with so all queries remain fully parameterised (no raw f-strings).
"""

import logging
from typing import Optional

from sqlalchemy import MetaData, Table
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


class NifiFlowRepository:
    """Repository for the dynamically-structured nifi_flows table."""

    def __init__(self, eng: Engine) -> None:
        self._engine = eng
        self._table: Optional[Table] = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_table(self) -> Table:
        """Return a reflected Table object, loading it on first access."""
        if self._table is None:
            metadata = MetaData()
            self._table = Table("nifi_flows", metadata, autoload_with=self._engine)
        return self._table

    def _invalidate_table_cache(self) -> None:
        """Drop the cached reflection so the next call re-reads from the DB.

        Call this whenever the nifi_flows schema is altered (e.g. after saving
        a new hierarchy config that adds or removes columns).
        """
        self._table = None

    def _row_to_dict(self, row) -> dict:
        return dict(row._mapping)

    # ------------------------------------------------------------------
    # Query methods
    # ------------------------------------------------------------------

    def list_all(self) -> list[dict]:
        """Return all flows ordered by created_at descending."""
        table = self._get_table()
        with self._engine.connect() as conn:
            result = conn.execute(table.select().order_by(table.c.created_at.desc()))
            return [self._row_to_dict(row) for row in result]

    def get_by_id(self, flow_id: int) -> Optional[dict]:
        """Return a single flow by primary key, or None if not found."""
        table = self._get_table()
        with self._engine.connect() as conn:
            result = conn.execute(table.select().where(table.c.id == flow_id))
            row = result.fetchone()
            return self._row_to_dict(row) if row else None

    def create(self, values: dict) -> int:
        """Insert a new flow row and return the generated id."""
        table = self._get_table()
        with self._engine.connect() as conn:
            result = conn.execute(table.insert().values(**values).returning(table.c.id))
            conn.commit()
            return result.fetchone()[0]

    def update(self, flow_id: int, values: dict) -> bool:
        """Update an existing flow, automatically setting updated_at.  Returns True if a row was updated."""
        from sqlalchemy import func  # noqa: PLC0415

        table = self._get_table()
        merged = {**values, "updated_at": func.now()}
        with self._engine.connect() as conn:
            result = conn.execute(
                table.update().where(table.c.id == flow_id).values(**merged)
            )
            conn.commit()
            return result.rowcount > 0

    def delete(self, flow_id: int) -> bool:
        """Delete a flow.  Returns True if a row was deleted."""
        table = self._get_table()
        with self._engine.connect() as conn:
            result = conn.execute(table.delete().where(table.c.id == flow_id))
            conn.commit()
            return result.rowcount > 0

    def get_columns(self) -> list[str]:
        """Return the reflection-based column names for the nifi_flows table."""
        table = self._get_table()
        return [col.name for col in table.columns]
