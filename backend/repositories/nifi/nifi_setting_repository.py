"""Repository for NiFi-related settings stored in the generic `settings` table."""

import json
import logging
from typing import Optional

from core.database import get_db_session
from core.models import Setting

logger = logging.getLogger(__name__)


class NifiSettingRepository:
    """Read and upsert `Setting` rows for the 'nifi' category."""

    def get_by_key(self, key: str) -> Optional[Setting]:
        """Return the Setting row for *key*, or None if absent."""
        db = get_db_session()
        try:
            return db.query(Setting).filter(Setting.key == key).first()
        finally:
            db.close()

    def upsert_json(
        self,
        key: str,
        value: dict,
        category: str = "nifi",
        description: str = "",
    ) -> None:
        """Create or update a setting storing *value* as a JSON string.

        Args:
            key: Setting key (must be unique across categories).
            value: Python dict to serialise as JSON.
            category: Setting category (defaults to 'nifi').
            description: Human-readable description stored on creation.
        """
        value_json = json.dumps(value)
        db = get_db_session()
        try:
            setting = db.query(Setting).filter(Setting.key == key).first()
            if setting:
                setting.value = value_json
            else:
                db.add(
                    Setting(
                        key=key,
                        value=value_json,
                        category=category,
                        value_type="json",
                        description=description,
                    )
                )
            db.commit()
            logger.debug("Upserted setting '%s'", key)
        finally:
            db.close()
