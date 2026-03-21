"""
Migration 016: Add redis_servers table.

Adds a new table to store multiple Redis server connection configurations,
allowing operators to manage Redis servers through the Settings UI.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "016_add_redis_servers"

    @property
    def description(self) -> str:
        return "Add redis_servers table for multi-server Redis configuration"

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
