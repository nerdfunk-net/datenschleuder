"""
Core configuration utilities and dependencies.
"""

from __future__ import annotations


def get_settings():
    """Get application settings."""
    from config import get_config

    return get_config()


def get_settings_manager():
    """Get settings manager instance."""
    from services.settings.settings_service import SettingsService

    return SettingsService()
