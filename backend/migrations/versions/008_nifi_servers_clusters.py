"""
Migration 008: Add NiFi servers, clusters, and cluster_servers tables.

Changes:
  - Creates nifi_servers table (physical/virtual machines hosting NiFi)
  - Creates nifi_clusters table (groups of servers forming a cluster)
  - Creates nifi_cluster_servers join table (server membership + primary flag)
  - Adds server_id FK column to nifi_instances
  - Makes hierarchy_attribute and hierarchy_value nullable on nifi_instances
  - Drops unique constraint uq_nifi_instance_hierarchy (now at cluster level)
"""

from sqlalchemy import text
from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "008_nifi_servers_clusters"

    @property
    def description(self) -> str:
        return (
            "Add nifi_servers, nifi_clusters, nifi_cluster_servers tables; "
            "link nifi_instances to servers; make hierarchy fields nullable"
        )

    def upgrade(self) -> dict:
        stats = {"constraints_dropped": 0, "columns_altered": 0}

        with self.engine.connect() as conn:
            # Drop the unique constraint on nifi_instances if it exists
            conn.execute(
                text(
                    "ALTER TABLE nifi_instances "
                    "DROP CONSTRAINT IF EXISTS uq_nifi_instance_hierarchy"
                )
            )
            conn.commit()
            self.log_info("Dropped unique constraint uq_nifi_instance_hierarchy")
            stats["constraints_dropped"] += 1

            # Make hierarchy_attribute nullable (was NOT NULL)
            conn.execute(
                text(
                    "ALTER TABLE nifi_instances "
                    "ALTER COLUMN hierarchy_attribute DROP NOT NULL"
                )
            )
            conn.commit()
            self.log_info("Made hierarchy_attribute nullable on nifi_instances")
            stats["columns_altered"] += 1

            # Make hierarchy_value nullable (was NOT NULL)
            conn.execute(
                text(
                    "ALTER TABLE nifi_instances "
                    "ALTER COLUMN hierarchy_value DROP NOT NULL"
                )
            )
            conn.commit()
            self.log_info("Made hierarchy_value nullable on nifi_instances")
            stats["columns_altered"] += 1

        # Auto migration creates new tables and adds new columns (server_id)
        auto = AutoSchemaMigration(self.engine, self.base)
        auto_stats = auto.run()

        return {**stats, **auto_stats}
