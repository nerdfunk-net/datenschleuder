"""
Migration 012: Add PKI manager tables.

Changes:
  - Creates pki_ca table (Certificate Authority)
  - Creates pki_certificates table (issued certificates)
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "012_add_pki_tables"

    @property
    def description(self) -> str:
        return "Add pki_ca and pki_certificates tables for the PKI Manager feature"

    def upgrade(self) -> dict:
        results = {"added": [], "dropped": [], "skipped": []}

        auto = AutoSchemaMigration(self.engine, self.base)
        auto.run()

        return results
