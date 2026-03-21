"""Migration 018: Add redis_server_id FK column to datenschleuder_agent_commands."""

from sqlalchemy import text

from migrations.base import BaseMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "018_add_redis_server_id_to_commands"

    @property
    def description(self) -> str:
        return "Add nullable redis_server_id FK to datenschleuder_agent_commands"

    def upgrade(self) -> dict:
        stats = {"columns_added": 0}
        with self.engine.connect() as conn:
            exists = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='datenschleuder_agent_commands' AND column_name='redis_server_id'"
                )
            ).fetchone()

            if exists is None:
                conn.execute(
                    text(
                        "ALTER TABLE datenschleuder_agent_commands "
                        "ADD COLUMN redis_server_id INTEGER NULL "
                        "REFERENCES redis_servers(id) ON DELETE SET NULL"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_ds_agent_command_redis_server "
                        "ON datenschleuder_agent_commands(redis_server_id)"
                    )
                )
                conn.commit()
                stats["columns_added"] += 1
                self.log_info("Added redis_server_id column and index")
            else:
                self.log_info("Column already exists, skipping")

        return stats
