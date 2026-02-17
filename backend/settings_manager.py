"""
Settings Database Management for Cockpit
Handles PostgreSQL database operations for application settings
"""

import os
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict, field
import json
import yaml
from repositories.settings.settings_repository import (
    GitSettingRepository,
    CacheSettingRepository,
    CelerySettingRepository,
    SettingsMetadataRepository,
)

# Import config to get environment variable defaults
try:
    from config import settings as env_settings
except ImportError:
    env_settings = None

logger = logging.getLogger(__name__)


@dataclass
class GitSettings:
    """Git repository settings for configs"""

    repo_url: str = ""
    branch: str = "main"
    username: str = ""
    token: str = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True


@dataclass
class CacheSettings:
    """Cache configuration for Git data and Nautobot resources"""

    enabled: bool = True
    ttl_seconds: int = 600  # 10 minutes
    prefetch_on_startup: bool = True
    refresh_interval_minutes: int = 15  # DEPRECATED: Use Celery Beat intervals instead
    max_commits: int = 500  # limit per branch
    # Map of items to prefetch on startup, e.g., {"git": true, "locations": false}
    prefetch_items: Dict[str, bool] = None

    # Cache task intervals (in minutes) - 0 means disabled
    devices_cache_interval_minutes: int = 60  # Cache devices every hour
    locations_cache_interval_minutes: int = 10  # Cache locations every 10 minutes
    git_commits_cache_interval_minutes: int = 15  # Cache git commits every 15 minutes


@dataclass
class CelerySettings:
    """
    Celery task queue settings.

    Queue System:
    -------------
    - Built-in queues (default, backup, network, heavy) are hardcoded in celery_app.py
    - Built-in queues have automatic task routing and cannot be deleted
    - Custom queues can be added here for documentation purposes
    - To use custom queues, configure CELERY_WORKER_QUEUE env var in docker-compose.yml
    - Tasks must be manually routed to custom queues: task.apply_async(queue='custom')

    Example: Adding a "monitoring" queue
    1. Add queue here: {"name": "monitoring", "description": "...", "built_in": false}
    2. Update docker-compose.yml: CELERY_WORKER_QUEUE=monitoring
    3. Route tasks: monitoring_task.apply_async(queue='monitoring')
    """

    max_workers: int = 4  # Worker concurrency (requires restart)
    cleanup_enabled: bool = True  # Enable automatic cleanup
    cleanup_interval_hours: int = 6  # Run cleanup every 6 hours
    cleanup_age_hours: int = 24  # Remove data older than 24 hours
    result_expires_hours: int = 24  # Celery result expiry
    queues: List[Dict[str, Any]] = field(
        default_factory=lambda: [
            {
                "name": "default",
                "description": "Default queue for general tasks",
                "built_in": True,
            },
            {
                "name": "backup",
                "description": "Queue for device backup operations",
                "built_in": True,
            },
            {
                "name": "network",
                "description": "Queue for network scanning and discovery tasks",
                "built_in": True,
            },
            {
                "name": "heavy",
                "description": "Queue for bulk operations and heavy processing tasks",
                "built_in": True,
            },
        ]
    )  # Queue configuration: [{"name": "backup", "description": "...", "built_in": true}]


class SettingsManager:
    """Manages application settings in PostgreSQL database"""

    def __init__(self):
        self.default_git = GitSettings()
        self.default_cache = CacheSettings()
        self.default_celery = CelerySettings()

        # PostgreSQL tables are created by alembic/SQLAlchemy
        # No database initialization needed

    def get_git_settings(self) -> Optional[Dict[str, Any]]:
        """Get current Git settings"""
        try:
            repo = GitSettingRepository()
            settings = repo.get_settings()

            if settings:
                return {
                    "repo_url": settings.repo_url,
                    "branch": settings.branch,
                    "username": settings.username or "",
                    "token": settings.token or "",
                    "config_path": settings.config_path,
                    "sync_interval": settings.sync_interval,
                    "verify_ssl": settings.verify_ssl,
                }
            else:
                # Fallback to defaults
                return asdict(self.default_git)

        except Exception as e:
            logger.error(f"Error getting Git settings: {e}")
            return asdict(self.default_git)

    def get_all_settings(self) -> Dict[str, Any]:
        """Get all settings combined"""
        return {
            "git": self.get_git_settings(),
            "cache": self.get_cache_settings(),
            "celery": self.get_celery_settings(),
            "metadata": self._get_metadata(),
        }

    def get_cache_settings(self) -> Dict[str, Any]:
        """Get current Cache settings"""
        try:
            repo = CacheSettingRepository()
            settings = repo.get_settings()

            if settings:
                return {
                    "enabled": settings.enabled,
                    "ttl_seconds": settings.ttl_seconds,
                    "prefetch_on_startup": settings.prefetch_on_startup,
                    "refresh_interval_minutes": settings.refresh_interval_minutes,
                    "max_commits": settings.max_commits,
                    "prefetch_items": json.loads(settings.prefetch_items)
                    if settings.prefetch_items
                    else {"git": True, "locations": False},
                    "devices_cache_interval_minutes": getattr(
                        settings,
                        "devices_cache_interval_minutes",
                        self.default_cache.devices_cache_interval_minutes,
                    ),
                    "locations_cache_interval_minutes": getattr(
                        settings,
                        "locations_cache_interval_minutes",
                        self.default_cache.locations_cache_interval_minutes,
                    ),
                    "git_commits_cache_interval_minutes": getattr(
                        settings,
                        "git_commits_cache_interval_minutes",
                        self.default_cache.git_commits_cache_interval_minutes,
                    ),
                }
            return asdict(self.default_cache)
        except Exception as e:
            logger.error(f"Error getting Cache settings: {e}")
            return asdict(self.default_cache)

    def update_cache_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Cache settings"""
        try:
            repo = CacheSettingRepository()
            existing = repo.get_settings()

            prefetch_items_json = json.dumps(
                settings.get("prefetch_items") or {"git": True, "locations": False}
            )

            update_kwargs = {
                "enabled": settings.get("enabled", self.default_cache.enabled),
                "ttl_seconds": settings.get(
                    "ttl_seconds", self.default_cache.ttl_seconds
                ),
                "prefetch_on_startup": settings.get(
                    "prefetch_on_startup", self.default_cache.prefetch_on_startup
                ),
                "refresh_interval_minutes": settings.get(
                    "refresh_interval_minutes",
                    self.default_cache.refresh_interval_minutes,
                ),
                "max_commits": settings.get(
                    "max_commits", self.default_cache.max_commits
                ),
                "prefetch_items": prefetch_items_json,
                "devices_cache_interval_minutes": settings.get(
                    "devices_cache_interval_minutes",
                    self.default_cache.devices_cache_interval_minutes,
                ),
                "locations_cache_interval_minutes": settings.get(
                    "locations_cache_interval_minutes",
                    self.default_cache.locations_cache_interval_minutes,
                ),
                "git_commits_cache_interval_minutes": settings.get(
                    "git_commits_cache_interval_minutes",
                    self.default_cache.git_commits_cache_interval_minutes,
                ),
            }

            if existing:
                repo.update(existing.id, **update_kwargs)
            else:
                repo.create(**update_kwargs)

            logger.info("Cache settings updated successfully")
            return True
        except Exception as e:
            logger.error(f"Error updating Cache settings: {e}")
            return False

    def get_celery_settings(self) -> Dict[str, Any]:
        """Get current Celery settings"""
        try:
            repo = CelerySettingRepository()
            settings = repo.get_settings()

            if settings:
                # Parse queues from JSON if present
                queues = []
                if settings.queues:
                    try:
                        queues = json.loads(settings.queues)
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse queues JSON, using empty list")
                        queues = []

                return {
                    "max_workers": settings.max_workers,
                    "cleanup_enabled": settings.cleanup_enabled,
                    "cleanup_interval_hours": settings.cleanup_interval_hours,
                    "cleanup_age_hours": settings.cleanup_age_hours,
                    "result_expires_hours": settings.result_expires_hours,
                    "queues": queues,
                }
            return asdict(self.default_celery)
        except Exception as e:
            logger.error(f"Error getting Celery settings: {e}")
            return asdict(self.default_celery)

    def update_celery_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Celery settings"""
        try:
            repo = CelerySettingRepository()
            existing = repo.get_settings()

            # Serialize queues to JSON if present
            queues_json = None
            if "queues" in settings:
                queues = settings.get("queues", [])
                if queues:
                    queues_json = json.dumps(queues)

            update_kwargs = {
                "max_workers": settings.get(
                    "max_workers", self.default_celery.max_workers
                ),
                "cleanup_enabled": settings.get(
                    "cleanup_enabled", self.default_celery.cleanup_enabled
                ),
                "cleanup_interval_hours": settings.get(
                    "cleanup_interval_hours", self.default_celery.cleanup_interval_hours
                ),
                "cleanup_age_hours": settings.get(
                    "cleanup_age_hours", self.default_celery.cleanup_age_hours
                ),
                "result_expires_hours": settings.get(
                    "result_expires_hours", self.default_celery.result_expires_hours
                ),
                "queues": queues_json,
            }

            if existing:
                repo.update(existing.id, **update_kwargs)
            else:
                repo.create(**update_kwargs)

            logger.info("Celery settings updated successfully")
            return True
        except Exception as e:
            logger.error(f"Error updating Celery settings: {e}")
            return False

    def ensure_builtin_queues(self) -> bool:
        """
        Ensure built-in queues (default, backup, network, heavy) exist in database.

        This is called on application startup to restore any missing built-in queues.
        Built-in queues are required for the system to function properly.

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Define built-in queues
            BUILTIN_QUEUES = [
                {
                    "name": "default",
                    "description": "Default queue for general tasks",
                    "built_in": True,
                },
                {
                    "name": "backup",
                    "description": "Queue for device backup operations",
                    "built_in": True,
                },
                {
                    "name": "network",
                    "description": "Queue for network scanning and discovery tasks",
                    "built_in": True,
                },
                {
                    "name": "heavy",
                    "description": "Queue for bulk operations and heavy processing tasks",
                    "built_in": True,
                },
            ]

            # Get current settings
            current = self.get_celery_settings()
            current_queues = current.get("queues", [])

            # Build set of existing queue names
            existing_names = {q["name"] for q in current_queues}

            # Add missing built-in queues
            queues_added = []
            for builtin_queue in BUILTIN_QUEUES:
                if builtin_queue["name"] not in existing_names:
                    current_queues.append(builtin_queue)
                    queues_added.append(builtin_queue["name"])
                    logger.info(
                        f"Restored missing built-in queue: {builtin_queue['name']}"
                    )
                else:
                    # Ensure existing built-in queue has built_in flag set
                    for q in current_queues:
                        if q["name"] == builtin_queue["name"]:
                            if not q.get("built_in"):
                                q["built_in"] = True
                                logger.info(
                                    f"Set built_in flag for queue: {builtin_queue['name']}"
                                )

            # Update settings if changes were made
            if queues_added or any(
                not q.get("built_in")
                for q in current_queues
                if q["name"] in {bq["name"] for bq in BUILTIN_QUEUES}
            ):
                current["queues"] = current_queues
                success = self.update_celery_settings(current)

                if success and queues_added:
                    logger.info(
                        f"Restored {len(queues_added)} built-in queue(s): {', '.join(queues_added)}"
                    )

                return success
            else:
                logger.debug("All built-in queues present and configured correctly")
                return True

        except Exception as e:
            logger.error(f"Error ensuring built-in queues: {e}")
            return False

    def update_git_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Git settings"""
        try:
            repo = GitSettingRepository()
            existing = repo.get_settings()

            if existing:
                repo.update(
                    existing.id,
                    repo_url=settings.get("repo_url", self.default_git.repo_url),
                    branch=settings.get("branch", self.default_git.branch),
                    username=settings.get("username", self.default_git.username),
                    token=settings.get("token", self.default_git.token),
                    config_path=settings.get(
                        "config_path", self.default_git.config_path
                    ),
                    sync_interval=settings.get(
                        "sync_interval", self.default_git.sync_interval
                    ),
                    verify_ssl=settings.get("verify_ssl", self.default_git.verify_ssl),
                )
            else:
                repo.create(
                    repo_url=settings.get("repo_url", self.default_git.repo_url),
                    branch=settings.get("branch", self.default_git.branch),
                    username=settings.get("username", self.default_git.username),
                    token=settings.get("token", self.default_git.token),
                    config_path=settings.get(
                        "config_path", self.default_git.config_path
                    ),
                    sync_interval=settings.get(
                        "sync_interval", self.default_git.sync_interval
                    ),
                    verify_ssl=settings.get("verify_ssl", self.default_git.verify_ssl),
                )

            logger.info("Git settings updated successfully")
            return True

        except Exception as e:
            logger.error(f"Error updating Git settings: {e}")
            return False

    def update_all_settings(self, settings: Dict[str, Any]) -> bool:
        """Update all settings"""
        success = True

        if "git" in settings:
            success &= self.update_git_settings(settings["git"])

        if "cache" in settings:
            success &= self.update_cache_settings(settings["cache"])

        if "celery" in settings:
            success &= self.update_celery_settings(settings["celery"])

        return success

    def _get_metadata(self) -> Dict[str, Any]:
        """Get database metadata"""
        try:
            repo = SettingsMetadataRepository()
            schema_version = repo.get_by_key("schema_version")

            metadata = {
                "schema_version": schema_version.value if schema_version else "1.0",
                "database_type": "postgresql",
            }

            return metadata

        except Exception as e:
            logger.error(f"Error getting metadata: {e}")
            return {"error": str(e)}

    def _handle_database_corruption(self) -> Dict[str, str]:
        """Handle database corruption - not applicable for PostgreSQL"""
        logger.warning(
            "Database corruption handler called - not applicable for PostgreSQL"
        )
        return {
            "status": "not_applicable",
            "message": "PostgreSQL manages corruption internally",
        }

    def reset_to_defaults(self) -> bool:
        """Reset all settings to defaults"""
        try:
            # Clear existing settings by deleting records
            from core.database import get_db_session
            from core.models import (
                GitSetting,
                CacheSetting,
                CelerySetting,
            )

            session = get_db_session()
            try:
                session.query(GitSetting).delete()
                session.query(CacheSetting).delete()
                session.query(CelerySetting).delete()
                session.commit()
                logger.info("Settings reset to defaults")
                return True
            finally:
                session.close()

        except Exception as e:
            logger.error(f"Error resetting settings: {e}")
            return False

    def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            git_repo = GitSettingRepository()
            cache_repo = CacheSettingRepository()
            celery_repo = CelerySettingRepository()

            git_count = 1 if git_repo.get_settings() else 0
            cache_count = 1 if cache_repo.get_settings() else 0
            celery_count = 1 if celery_repo.get_settings() else 0

            return {
                "status": "healthy",
                "database_type": "postgresql",
                "git_settings_count": git_count,
                "cache_settings_count": cache_count,
                "celery_settings_count": celery_count,
            }

        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e), "recovery_needed": False}

    def get_selected_git_repository(self) -> Optional[int]:
        """Get the currently selected Git repository ID for configuration comparison."""
        try:
            repo = SettingsMetadataRepository()
            result = repo.get_by_key("selected_git_repository")
            return int(result.value) if result and result.value else None

        except Exception as e:
            logger.error(f"Error getting selected Git repository: {e}")
            return None

    def set_selected_git_repository(self, repository_id: int) -> bool:
        """Set the selected Git repository ID for configuration comparison."""
        try:
            repo = SettingsMetadataRepository()
            repo.set_metadata("selected_git_repository", str(repository_id))
            logger.info(f"Selected Git repository set to ID: {repository_id}")
            return True

        except Exception as e:
            logger.error(f"Error setting selected Git repository: {e}")
            return False

    # OIDC Provider Management
    def get_oidc_providers_config_path(self) -> str:
        """Get path to OIDC providers YAML configuration file"""
        from pathlib import Path

        # Use Path-based navigation like CheckMK config service
        # Navigate from backend/settings_manager.py -> backend/ -> project_root/ -> config/
        config_path = Path(__file__).parent.parent / "config" / "oidc_providers.yaml"
        return str(config_path)

    def load_oidc_providers(self) -> Dict[str, Any]:
        """Load OIDC providers configuration from YAML file"""
        config_path = self.get_oidc_providers_config_path()

        if not os.path.exists(config_path):
            logger.warning(f"OIDC providers config not found at {config_path}")
            return {"providers": {}, "global": {"allow_traditional_login": True}}

        try:
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)

            if not config:
                logger.warning("OIDC providers config is empty")
                return {"providers": {}, "global": {"allow_traditional_login": True}}

            # Validate structure
            if "providers" not in config:
                config["providers"] = {}
            if "global" not in config:
                config["global"] = {"allow_traditional_login": True}

            logger.info(
                f"Loaded {len(config.get('providers', {}))} OIDC provider(s) from config"
            )
            return config

        except yaml.YAMLError as e:
            logger.error(f"Error parsing OIDC providers YAML: {e}")
            return {"providers": {}, "global": {"allow_traditional_login": True}}
        except Exception as e:
            logger.error(f"Error loading OIDC providers config: {e}")
            return {"providers": {}, "global": {"allow_traditional_login": True}}

    def get_oidc_providers(self) -> Dict[str, Dict[str, Any]]:
        """Get all OIDC providers from config"""
        config = self.load_oidc_providers()
        return config.get("providers", {})

    def get_enabled_oidc_providers(self) -> List[Dict[str, Any]]:
        """Get list of enabled OIDC providers sorted by display_order"""
        providers = self.get_oidc_providers()

        enabled_providers = []
        for provider_id, provider_config in providers.items():
            if provider_config.get("enabled", False):
                # Add provider_id to the config for reference
                provider_data = provider_config.copy()
                provider_data["provider_id"] = provider_id
                enabled_providers.append(provider_data)

        # Sort by display_order
        enabled_providers.sort(key=lambda p: p.get("display_order", 999))

        logger.info(f"Found {len(enabled_providers)} enabled OIDC provider(s)")
        return enabled_providers

    def get_oidc_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """Get specific OIDC provider configuration by ID"""
        providers = self.get_oidc_providers()
        provider = providers.get(provider_id)

        if provider:
            # Add provider_id to the config
            provider_data = provider.copy()
            provider_data["provider_id"] = provider_id
            return provider_data

        logger.warning(f"OIDC provider '{provider_id}' not found in config")
        return None

    def get_oidc_global_settings(self) -> Dict[str, Any]:
        """Get global OIDC settings"""
        config = self.load_oidc_providers()
        return config.get("global", {"allow_traditional_login": True})

    def is_oidc_enabled(self) -> bool:
        """Check if at least one OIDC provider is enabled"""
        enabled_providers = self.get_enabled_oidc_providers()
        return len(enabled_providers) > 0


# Global settings manager instance
settings_manager = SettingsManager()
