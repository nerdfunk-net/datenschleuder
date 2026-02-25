"""
Migration 002: Add registry_flow_metadata table.

Adds per-flow key-value metadata table so users can attach mandatory and
optional properties to registry flow references without modifying NiFi itself.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "002_add_registry_flow_metadata"

    @property
    def description(self) -> str:
        return "Add registry_flow_metadata table for per-flow key-value metadata"

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
