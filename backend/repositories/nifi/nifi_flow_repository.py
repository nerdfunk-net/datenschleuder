"""NiFi flow repository — SQLAlchemy Core Table with dynamic column reflection.

The nifi_flows table schema is not fixed at model time; its columns are derived
from the hierarchy configuration.  We reflect the live table once per instance
via autoload_with so all queries remain fully parameterised (no raw f-strings).
"""

import logging
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    func,
    inspect,
    select,
)
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
        if not inspect(self._engine).has_table("nifi_flows"):
            return []
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

    def has_table(self) -> bool:
        """Return True if the nifi_flows table exists in the database."""
        return inspect(self._engine).has_table("nifi_flows")

    def count(self) -> int:
        """Return the number of rows, or 0 if the table does not exist."""
        if not inspect(self._engine).has_table("nifi_flows"):
            return 0
        table = self._get_table()
        with self._engine.connect() as conn:
            result = conn.execute(select(func.count()).select_from(table))
            return result.scalar() or 0

    def recreate_table(self, hierarchy: list) -> dict:
        """Drop and recreate nifi_flows with columns derived from hierarchy.

        Replaces the raw DROP TABLE SQL with SQLAlchemy's table.drop() and
        invalidates the reflection cache so subsequent queries see the new schema.
        Returns a summary dict with table_name, hierarchy_columns, total_columns.
        """
        hierarchy = sorted(hierarchy, key=lambda x: x.get("order", 0))

        old_meta = MetaData()
        old_table = Table("nifi_flows", old_meta)
        old_table.drop(self._engine, checkfirst=True)
        self._invalidate_table_cache()

        metadata = MetaData()
        columns: list = [Column("id", Integer, primary_key=True, index=True)]
        for attr in hierarchy:
            attr_name = attr["name"].lower()
            columns.append(Column(f"src_{attr_name}", String, nullable=False, index=True))
            columns.append(Column(f"dest_{attr_name}", String, nullable=False, index=True))
        columns.extend(
            [
                Column("name", String, nullable=True),
                Column("contact", String, nullable=True),
                Column("src_connection_param", String, nullable=False),
                Column("dest_connection_param", String, nullable=False),
                Column("src_template_id", Integer, nullable=True),
                Column("dest_template_id", Integer, nullable=True),
                Column("active", Boolean, nullable=False, default=True),
                Column("description", Text, nullable=True),
                Column("creator_name", String, nullable=True),
                Column("created_at", DateTime(timezone=True), server_default=func.now()),
                Column(
                    "updated_at",
                    DateTime(timezone=True),
                    server_default=func.now(),
                    onupdate=func.now(),
                ),
            ]
        )
        Table("nifi_flows", metadata, *columns)
        metadata.create_all(self._engine)

        hierarchy_columns = [
            {
                "name": attr["name"],
                "src_column": f"src_{attr['name'].lower()}",
                "dest_column": f"dest_{attr['name'].lower()}",
            }
            for attr in hierarchy
        ]
        logger.info("Recreated nifi_flows table with %d hierarchy columns", len(hierarchy_columns))
        return {
            "table_name": "nifi_flows",
            "hierarchy_columns": hierarchy_columns,
            "total_columns": len(columns),
        }


# Module-level singleton — shares the reflected table cache across the application.
from core.database import engine as _engine  # noqa: E402

nifi_flow_repository = NifiFlowRepository(_engine)
