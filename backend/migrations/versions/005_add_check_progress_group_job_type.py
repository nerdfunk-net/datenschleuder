"""
Migration 005: Add check_progress_group job type support.

Adds five columns that configure how the check_progress_group Celery task
verifies the operational status of a NiFi process group:

  check_progress_group_nifi_instance_id   INTEGER  – target NiFi instance
  check_progress_group_process_group_id   TEXT     – UUID of the process group
  check_progress_group_process_group_path TEXT     – formatted path (for display)
  check_progress_group_check_children     BOOLEAN  – include child groups
  check_progress_group_expected_status    TEXT     – Running|Stopped|Enabled|Disabled

Also updates the job_type check constraint to allow 'check_progress_group'.
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "005_add_check_progress_group_job_type"

    @property
    def description(self) -> str:
        return (
            "Add check_progress_group job type: five new columns and updated "
            "job_type check constraint"
        )

    def upgrade(self) -> dict:
        stats = {"columns_added": 0, "constraints_updated": 0}

        new_columns = {
            "check_progress_group_nifi_instance_id": "INTEGER",
            "check_progress_group_process_group_id": "TEXT",
            "check_progress_group_process_group_path": "TEXT",
            "check_progress_group_check_children": "BOOLEAN DEFAULT TRUE",
            "check_progress_group_expected_status": "TEXT DEFAULT 'Running'",
        }

        with self.engine.connect() as conn:
            auto = AutoSchemaMigration(self.engine, self.base)
            existing_columns = auto.get_existing_columns("job_templates")

            # 1. Add new columns
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

            # 2. Update the job_type check constraint to include check_progress_group
            try:
                conn.execute(
                    text(
                        "ALTER TABLE job_templates DROP CONSTRAINT IF EXISTS ck_job_templates_job_type"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE job_templates ADD CONSTRAINT ck_job_templates_job_type "
                        "CHECK (job_type IN ("
                        "'backup', 'compare_devices', 'run_commands', 'sync_devices', "
                        "'scan_prefixes', 'deploy_agent', 'check_queues', 'check_progress_group'"
                        "))"
                    )
                )
                conn.commit()
                stats["constraints_updated"] += 1
                self.log_info(
                    "Updated ck_job_templates_job_type constraint to include check_progress_group"
                )
            except Exception as exc:
                self.log_warning("Could not update check constraint: %s" % exc)

        return stats
