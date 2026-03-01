"""
Migration 009: Add nifi_cluster_instances table.

Changes:
  - Creates nifi_cluster_instances join table linking NiFi clusters to NiFi instances
    (replaces the server-based membership: clusters now reference instances directly)
  - Each instance can belong to at most one cluster (UNIQUE on instance_id)
  - The is_primary flag marks the primary instance used for registry operations
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "009_nifi_cluster_instances"

    @property
    def description(self) -> str:
        return (
            "Add nifi_cluster_instances table linking clusters to NiFi instances; "
            "clusters now reference instances directly instead of servers"
        )

    def upgrade(self) -> dict:
        # AutoSchemaMigration detects the new NifiClusterInstance model and creates
        # the nifi_cluster_instances table automatically.
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
