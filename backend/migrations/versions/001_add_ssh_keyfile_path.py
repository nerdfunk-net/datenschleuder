"""
Migration 001: Add ssh_keyfile_path column to credentials table.

Adds an optional path field so SSH Key credentials can reference an existing
key file on disk instead of requiring an uploaded or pasted private key.
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "001_add_ssh_keyfile_path"

    @property
    def description(self) -> str:
        return "Add ssh_keyfile_path column to credentials table"

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
