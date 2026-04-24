"""Celery Settings Service.

Handles validation and updating of Celery settings.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Built-in queues that are always required and cannot be removed.
# TODO: Load from celery_app configuration instead of hard-coding.
_BUILT_IN_QUEUE_NAMES = frozenset({"default", "backup", "network", "heavy"})


class CelerySettingsService:
    """Service for Celery settings management."""

    def __init__(self, settings_manager=None):
        if settings_manager is None:
            from services.settings.settings_service import SettingsService

            settings_manager = SettingsService()
        self.settings_manager = settings_manager

    def get_settings(self) -> dict:
        """Return current Celery settings."""
        return self.settings_manager.get_celery_settings()

    def update_settings(self, updates: dict) -> dict:
        """Validate and apply Celery settings updates.

        Args:
            updates: Partial settings dict from the request (exclude_unset).

        Returns:
            Updated settings dict.

        Raises:
            HTTPException 400 if built-in queues are missing from queue list.
            HTTPException 500 if the settings save fails.
        """
        if "queues" in updates:
            self._validate_queue_config(updates["queues"])

        current = self.settings_manager.get_celery_settings()
        merged = {**current, **updates}

        if not self.settings_manager.update_celery_settings(merged):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Celery settings",
            )

        return self.settings_manager.get_celery_settings()

    def _validate_queue_config(self, queues: list) -> None:
        """Ensure all built-in queues are present and mark them accordingly.

        Args:
            queues: List of queue config dicts (mutated in place to set built_in flag).

        Raises:
            HTTPException 400 if a built-in queue is missing.
        """
        updated_names = {q["name"] for q in queues}
        missing = _BUILT_IN_QUEUE_NAMES - updated_names
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot remove built-in queues: {', '.join(missing)}. "
                    "Built-in queues (default, backup, network, heavy) are required."
                ),
            )

        for queue in queues:
            queue["built_in"] = queue["name"] in _BUILT_IN_QUEUE_NAMES

    def get_built_in_queue_names(self) -> frozenset:
        """Return the set of built-in queue names."""
        return _BUILT_IN_QUEUE_NAMES
