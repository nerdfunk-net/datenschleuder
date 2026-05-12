"""Convert pki_certificates.organization and org_unit columns to JSON arrays."""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "020_pki_org_json"

    @property
    def description(self) -> str:
        return "Convert pki_certificates.organization and org_unit to JSON arrays for multi-value support"

    def upgrade(self) -> dict:
        stats = {"columns_converted": 0, "rows_migrated": 0}
        with self.engine.connect() as conn:
            for col in ("organization", "org_unit"):
                # Add staging JSON column
                conn.execute(text(
                    f"ALTER TABLE pki_certificates "
                    f"ADD COLUMN IF NOT EXISTS {col}_json JSON"
                ))
                conn.commit()

                # Backfill: wrap existing single-string values in a JSON array
                result = conn.execute(text(
                    f"UPDATE pki_certificates "
                    f"SET {col}_json = json_build_array({col}) "
                    f"WHERE {col} IS NOT NULL"
                ))
                stats["rows_migrated"] += result.rowcount
                conn.commit()

                # Drop old VARCHAR column and rename the new JSON column
                conn.execute(text(f"ALTER TABLE pki_certificates DROP COLUMN {col}"))
                conn.execute(text(
                    f"ALTER TABLE pki_certificates RENAME COLUMN {col}_json TO {col}"
                ))
                conn.commit()
                stats["columns_converted"] += 1

        return stats
