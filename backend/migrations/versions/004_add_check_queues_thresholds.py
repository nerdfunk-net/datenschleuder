"""
Migration 004: Add check_queues threshold and mode columns to job_templates.

Adds five columns that configure how the check_queues Celery task evaluates
NiFi connection queue depths:

  check_queues_mode         TEXT      – 'count', 'bytes', or 'both'
  check_queues_count_yellow INTEGER   – flow-file count → yellow
  check_queues_count_red    INTEGER   – flow-file count → red
  check_queues_bytes_yellow INTEGER   – queue size in MB → yellow
  check_queues_bytes_red    INTEGER   – queue size in MB → red
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "004_add_check_queues_thresholds"

    @property
    def description(self) -> str:
        return (
            "Add check_queues_mode, check_queues_count_yellow/red and "
            "check_queues_bytes_yellow/red columns to job_templates"
        )

    def upgrade(self) -> dict:
        stats = {"columns_added": 0}

        new_columns = {
            "check_queues_mode": "TEXT DEFAULT 'count'",
            "check_queues_count_yellow": "INTEGER DEFAULT 1000",
            "check_queues_count_red": "INTEGER DEFAULT 10000",
            "check_queues_bytes_yellow": "INTEGER DEFAULT 10",
            "check_queues_bytes_red": "INTEGER DEFAULT 100",
        }

        with self.engine.connect() as conn:
            auto = AutoSchemaMigration(self.engine, self.base)
            existing_columns = auto.get_existing_columns("job_templates")

            for col_name, col_def in new_columns.items():
                if col_name not in existing_columns:
                    conn.execute(
                        text(
                            "ALTER TABLE job_templates ADD COLUMN %s %s"
                            % (col_name, col_def)
                        )
                    )
                    conn.commit()
                    stats["columns_added"] += 1
                    self.log_info("Added column '%s' to job_templates" % col_name)
                else:
                    self.log_info("Column '%s' already exists, skipping" % col_name)

        return stats
