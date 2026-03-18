"""Migration 013: Add installation_type column to nifi_servers table.

Changes:
  - Adds installation_type column (varchar 50, default 'bare') to nifi_servers
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "013_add_nifi_server_installation_type"

    @property
    def description(self) -> str:
        return "Add installation_type column to nifi_servers (values: docker, bare)"

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
