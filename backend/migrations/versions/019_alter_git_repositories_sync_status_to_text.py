"""Migration 019: Change git_repositories.sync_status from VARCHAR(255) to TEXT."""

from sqlalchemy import text

from migrations.base import BaseMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "019_alter_git_repositories_sync_status_to_text"

    @property
    def description(self) -> str:
        return "Change git_repositories.sync_status from VARCHAR(255) to TEXT to accommodate long error messages"

    def upgrade(self) -> dict:
        stats = {"columns_altered": 0}
        with self.engine.connect() as conn:
            data_type = conn.execute(
                text(
                    "SELECT data_type FROM information_schema.columns "
                    "WHERE table_name='git_repositories' AND column_name='sync_status'"
                )
            ).fetchone()

            if data_type and data_type[0] != "text":
                conn.execute(
                    text(
                        "ALTER TABLE git_repositories "
                        "ALTER COLUMN sync_status TYPE TEXT"
                    )
                )
                conn.commit()
                stats["columns_altered"] += 1
                self.log_info("Changed sync_status column from VARCHAR(255) to TEXT")
            else:
                self.log_info("Column already TEXT or not found, skipping")

        return stats
