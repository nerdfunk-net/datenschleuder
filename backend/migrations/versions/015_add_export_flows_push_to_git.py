"""
Migration 015: Add export_flows_push_to_git column to job_templates.

Adds a boolean column that controls whether the export_flows executor
commits and pushes the exported file to the git repository after writing it.
Default is TRUE to preserve the existing behaviour.
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "015_add_export_flows_push_to_git"

    @property
    def description(self) -> str:
        return "Add export_flows_push_to_git boolean column to job_templates"

    def upgrade(self) -> dict:
        stats = {"columns_added": 0}

        with self.engine.connect() as conn:
            auto = AutoSchemaMigration(self.engine, self.base)
            existing_columns = auto.get_existing_columns("job_templates")

            if "export_flows_push_to_git" not in existing_columns:
                conn.execute(
                    text(
                        "ALTER TABLE job_templates ADD COLUMN export_flows_push_to_git BOOLEAN DEFAULT TRUE"
                    )
                )
                conn.commit()
                stats["columns_added"] += 1
                self.log_info(
                    "Added column 'export_flows_push_to_git' to job_templates"
                )
            else:
                self.log_info(
                    "Column 'export_flows_push_to_git' already exists, skipping"
                )

        return stats
