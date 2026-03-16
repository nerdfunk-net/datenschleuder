"""
Migration 003: Add check_queues job type support.

Adds nifi_instance_ids column to job_templates for storing which NiFi
instances a check_queues job should target. Updates the job_type check
constraint to allow the new 'check_queues' value.
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "003_add_check_queues_job_type"

    @property
    def description(self) -> str:
        return "Add check_queues job type: nifi_instance_ids column and updated job_type constraint"

    def upgrade(self) -> dict:
        stats = {"columns_added": 0, "constraints_updated": 0}

        with self.engine.connect() as conn:
            # 1. Add nifi_instance_ids column via auto-schema detection
            auto = AutoSchemaMigration(self.engine, self.base)
            existing_columns = auto.get_existing_columns("job_templates")

            if "nifi_instance_ids" not in existing_columns:
                conn.execute(
                    text("ALTER TABLE job_templates ADD COLUMN nifi_instance_ids TEXT")
                )
                conn.commit()
                stats["columns_added"] += 1
                self.log_info("Added nifi_instance_ids column to job_templates")
            else:
                self.log_info("nifi_instance_ids column already exists, skipping")

            # 2. Update the job_type check constraint to include check_queues
            #    PostgreSQL requires dropping the old constraint before adding the new one.
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
                        "'scan_prefixes', 'deploy_agent', 'check_queues'"
                        "))"
                    )
                )
                conn.commit()
                stats["constraints_updated"] += 1
                self.log_info(
                    "Updated ck_job_templates_job_type constraint to include check_queues"
                )
            except Exception as exc:
                self.log_warning(f"Could not update check constraint: {exc}")

        return stats
