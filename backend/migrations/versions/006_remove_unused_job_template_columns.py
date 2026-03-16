"""
Migration 006: Remove unused job template columns.

Removes columns that belonged to job types no longer supported:
  backup, compare_devices, run_commands, sync_devices, scan_prefixes, deploy_agent.

Dropped columns:
  config_repository_id
  inventory_source
  inventory_repository_id
  inventory_name
  command_template_name
  backup_running_config_path
  backup_startup_config_path
  write_timestamp_to_custom_field
  timestamp_custom_field_name
  activate_changes_after_sync
  scan_resolve_dns
  scan_ping_count
  scan_timeout_ms
  scan_retries
  scan_interval_ms
  scan_custom_field_name
  scan_custom_field_value
  scan_response_custom_field_name
  scan_set_reachable_ip_active
  scan_max_ips
  parallel_tasks
  deploy_template_id
  deploy_agent_id
  deploy_path
  deploy_custom_variables
  deploy_templates
  activate_after_deploy

Also narrows the job_type CHECK constraint to only the two active types:
  check_queues, check_progress_group
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


COLUMNS_TO_DROP = [
    "config_repository_id",
    "inventory_source",
    "inventory_repository_id",
    "inventory_name",
    "command_template_name",
    "backup_running_config_path",
    "backup_startup_config_path",
    "write_timestamp_to_custom_field",
    "timestamp_custom_field_name",
    "activate_changes_after_sync",
    "scan_resolve_dns",
    "scan_ping_count",
    "scan_timeout_ms",
    "scan_retries",
    "scan_interval_ms",
    "scan_custom_field_name",
    "scan_custom_field_value",
    "scan_response_custom_field_name",
    "scan_set_reachable_ip_active",
    "scan_max_ips",
    "parallel_tasks",
    "deploy_template_id",
    "deploy_agent_id",
    "deploy_path",
    "deploy_custom_variables",
    "deploy_templates",
    "activate_after_deploy",
]

ACTIVE_JOB_TYPES = "'check_queues', 'check_progress_group'"


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "006_remove_unused_job_template_columns"

    @property
    def description(self) -> str:
        return (
            "Remove unused job template columns for backup/scan/deploy/inventory "
            "job types and narrow the job_type CHECK constraint"
        )

    def upgrade(self) -> dict:
        stats = {"columns_dropped": 0, "constraints_updated": 0}

        with self.engine.connect() as conn:
            auto = AutoSchemaMigration(self.engine, self.base)
            existing_columns = auto.get_existing_columns("job_templates")

            # 1. Drop obsolete columns
            for col_name in COLUMNS_TO_DROP:
                if col_name in existing_columns:
                    conn.execute(
                        text(
                            "ALTER TABLE job_templates DROP COLUMN IF EXISTS %s"
                            % col_name
                        )
                    )
                    conn.commit()
                    stats["columns_dropped"] += 1
                    self.log_info("Dropped column '%s' from job_templates" % col_name)
                else:
                    self.log_info("Column '%s' not found, skipping" % col_name)

            # 2. Update the job_type check constraint to only allow active types
            try:
                conn.execute(
                    text(
                        "ALTER TABLE job_templates DROP CONSTRAINT IF EXISTS ck_job_templates_job_type"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE job_templates ADD CONSTRAINT ck_job_templates_job_type "
                        "CHECK (job_type IN (%s))" % ACTIVE_JOB_TYPES
                    )
                )
                conn.commit()
                stats["constraints_updated"] += 1
                self.log_info(
                    "Updated ck_job_templates_job_type constraint to: %s"
                    % ACTIVE_JOB_TYPES
                )
            except Exception as exc:
                self.log_info("Failed to update constraint: %s" % exc)

        return stats
