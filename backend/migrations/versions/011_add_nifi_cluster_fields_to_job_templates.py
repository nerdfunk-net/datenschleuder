"""
Migration 011: Migrate job_templates from NiFi instances to NiFi clusters.

Changes:
  - Adds nifi_cluster_ids (TEXT, JSON array) to job_templates
  - Adds check_progress_group_nifi_cluster_id (INTEGER FK → nifi_clusters.id)
  - Drops nifi_instance_ids (replaced by nifi_cluster_ids)
  - Drops check_progress_group_nifi_instance_id (replaced by check_progress_group_nifi_cluster_id)
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "011_add_nifi_cluster_fields_to_job_templates"

    @property
    def description(self) -> str:
        return (
            "Replace NiFi instance references in job_templates with cluster references: "
            "add nifi_cluster_ids and check_progress_group_nifi_cluster_id, "
            "drop nifi_instance_ids and check_progress_group_nifi_instance_id"
        )

    def upgrade(self) -> dict:
        results = {"added": [], "dropped": [], "skipped": []}

        with self.engine.connect() as conn:
            existing = self._get_existing_columns(conn, "job_templates")

            # Add new cluster columns
            auto = AutoSchemaMigration(self.engine, self.base)
            auto_result = auto.run()
            results["added"].extend(auto_result.get("added", []))

            # Drop old instance columns
            for col in ("nifi_instance_ids", "check_progress_group_nifi_instance_id"):
                if col in existing:
                    conn.execute(
                        self._text("ALTER TABLE job_templates DROP COLUMN %s" % col)
                    )
                    conn.commit()
                    results["dropped"].append("job_templates.%s" % col)
                    self.log_info("Dropped column job_templates.%s" % col)
                else:
                    results["skipped"].append("job_templates.%s (already absent)" % col)

        return results

    def _get_existing_columns(self, conn, table: str):
        """Return set of column names for the given table."""
        from sqlalchemy import inspect

        inspector = inspect(conn)
        return {c["name"] for c in inspector.get_columns(table)}

    def _text(self, sql: str):
        from sqlalchemy import text

        return text(sql)
