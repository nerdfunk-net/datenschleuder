"""
Migration 014: Add export_flows job type support.

Adds six columns that configure how the export_flows Celery task serialises
NiFi flows from the local database and commits them to a git repository:

  export_flows_nifi_cluster_ids   TEXT     – JSON array of cluster IDs (informational)
  export_flows_all_flows          BOOLEAN  – export every flow when True
  export_flows_filters            TEXT     – JSON hierarchy filter conditions
  export_flows_git_repo_id        INTEGER  – FK → git_repositories.id
  export_flows_filename           TEXT     – output filename
  export_flows_export_type        TEXT     – 'json' or 'csv'

Also updates the job_type check constraint to allow 'export_flows'.
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "014_add_export_flows_job_type"

    @property
    def description(self) -> str:
        return (
            "Add export_flows job type: six new columns and updated "
            "job_type check constraint"
        )

    def upgrade(self) -> dict:
        stats = {"columns_added": 0, "constraints_updated": 0}

        new_columns = {
            "export_flows_nifi_cluster_ids": "TEXT",
            "export_flows_all_flows": "BOOLEAN DEFAULT TRUE",
            "export_flows_filters": "TEXT",
            "export_flows_git_repo_id": "INTEGER",
            "export_flows_filename": "TEXT",
            "export_flows_export_type": "TEXT DEFAULT 'json'",
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

            # 2. Update the job_type check constraint to include export_flows
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
                        "'scan_prefixes', 'deploy_agent', 'check_queues', 'check_progress_group', "
                        "'export_flows'"
                        "))"
                    )
                )
                conn.commit()
                stats["constraints_updated"] += 1
                self.log_info(
                    "Updated ck_job_templates_job_type constraint to include export_flows"
                )
            except Exception as exc:
                self.log_warning("Could not update check constraint: %s" % exc)

        return stats
