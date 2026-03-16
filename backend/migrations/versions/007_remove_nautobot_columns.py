"""
Migration 007: Remove nautobot-related columns.

Removes the use_nautobot_context column from the templates table.
This column was used to optionally inject device context from Nautobot
into template rendering, which is no longer supported.

Dropped columns (templates):
  use_nautobot_context
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "007_remove_nautobot_columns"

    @property
    def description(self) -> str:
        return "Remove nautobot-related columns from templates table"

    def upgrade(self) -> dict:
        stats = {"columns_dropped": 0}

        with self.engine.connect() as conn:
            auto = AutoSchemaMigration(self.engine, self.base)
            existing_columns = auto.get_existing_columns("templates")

            if "use_nautobot_context" in existing_columns:
                conn.execute(
                    text(
                        "ALTER TABLE templates DROP COLUMN IF EXISTS use_nautobot_context"
                    )
                )
                conn.commit()
                stats["columns_dropped"] += 1
                self.log_info("Dropped column 'use_nautobot_context' from templates")
            else:
                self.log_info("Column 'use_nautobot_context' not found, skipping")

        return stats
