"""Migration: Add git_config_repo_id to nifi_instances table."""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "010_nifi_instance_git_config"

    @property
    def description(self) -> str:
        return "Add git_config_repo_id column to nifi_instances for linking a NiFi Configs git repository"

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
