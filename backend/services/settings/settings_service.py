"""Application settings service.

Manages database-backed settings for Git, Cache, and Celery configurations.
"""

from __future__ import annotations
import logging
import json
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional
from repositories.settings.settings_repository import (
    GitSettingRepository,
    CacheSettingRepository,
    CelerySettingRepository,
    SettingsMetadataRepository,
)

logger = logging.getLogger(__name__)


@dataclass
class GitSettings:
    repo_url: str = ""
    branch: str = "main"
    username: str = ""
    token: str = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True


@dataclass
class CacheSettings:
    enabled: bool = True
    ttl_seconds: int = 600
    prefetch_on_startup: bool = True
    refresh_interval_minutes: int = 15
    max_commits: int = 500
    prefetch_items: Dict[str, bool] = None
    git_commits_cache_interval_minutes: int = 15


@dataclass
class CelerySettings:
    max_workers: int = 4
    cleanup_enabled: bool = True
    cleanup_interval_hours: int = 6
    cleanup_age_hours: int = 24
    result_expires_hours: int = 24
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
    )


class SettingsService:
    def __init__(self):
        self.default_git = GitSettings()
        self.default_cache = CacheSettings()
        self.default_celery = CelerySettings()

    def get_git_settings(self) -> Optional[Dict[str, Any]]:
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
            return asdict(self.default_git)
        except Exception as e:
            logger.error("Error getting Git settings: %s", e)
            return asdict(self.default_git)

    def get_all_settings(self) -> Dict[str, Any]:
        return {
            "git": self.get_git_settings(),
            "cache": self.get_cache_settings(),
            "celery": self.get_celery_settings(),
            "metadata": self._get_metadata(),
        }

    def get_cache_settings(self) -> Dict[str, Any]:
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
                    "git_commits_cache_interval_minutes": getattr(
                        settings,
                        "git_commits_cache_interval_minutes",
                        self.default_cache.git_commits_cache_interval_minutes,
                    ),
                }
            return asdict(self.default_cache)
        except Exception as e:
            logger.error("Error getting Cache settings: %s", e)
            return asdict(self.default_cache)

    def update_cache_settings(self, settings: Dict[str, Any]) -> bool:
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
            logger.error("Error updating Cache settings: %s", e)
            return False

    def get_celery_settings(self) -> Dict[str, Any]:
        try:
            repo = CelerySettingRepository()
            settings = repo.get_settings()
            if settings:
                queues = []
                if settings.queues:
                    try:
                        queues = json.loads(settings.queues)
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse queues JSON, using empty list")
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
            logger.error("Error getting Celery settings: %s", e)
            return asdict(self.default_celery)

    def update_celery_settings(self, settings: Dict[str, Any]) -> bool:
        try:
            repo = CelerySettingRepository()
            existing = repo.get_settings()
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
            logger.error("Error updating Celery settings: %s", e)
            return False

    def ensure_builtin_queues(self) -> bool:
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
        try:
            current = self.get_celery_settings()
            current_queues = current.get("queues", [])
            existing_names = {q["name"] for q in current_queues}
            queues_added = []
            for builtin_queue in BUILTIN_QUEUES:
                if builtin_queue["name"] not in existing_names:
                    current_queues.append(builtin_queue)
                    queues_added.append(builtin_queue["name"])
                    logger.info(
                        "Restored missing built-in queue: %s", builtin_queue["name"]
                    )
                else:
                    for q in current_queues:
                        if q["name"] == builtin_queue["name"] and not q.get("built_in"):
                            q["built_in"] = True
                            logger.info(
                                "Set built_in flag for queue: %s", builtin_queue["name"]
                            )
            if queues_added or any(
                not q.get("built_in")
                for q in current_queues
                if q["name"] in {bq["name"] for bq in BUILTIN_QUEUES}
            ):
                current["queues"] = current_queues
                success = self.update_celery_settings(current)
                if success and queues_added:
                    logger.info(
                        "Restored %s built-in queue(s): %s",
                        len(queues_added),
                        ", ".join(queues_added),
                    )
                return success
            logger.debug("All built-in queues present and configured correctly")
            return True
        except Exception as e:
            logger.error("Error ensuring built-in queues: %s", e)
            return False

    def update_git_settings(self, settings: Dict[str, Any]) -> bool:
        try:
            repo = GitSettingRepository()
            existing = repo.get_settings()
            kwargs = {
                "repo_url": settings.get("repo_url", self.default_git.repo_url),
                "branch": settings.get("branch", self.default_git.branch),
                "username": settings.get("username", self.default_git.username),
                "token": settings.get("token", self.default_git.token),
                "config_path": settings.get(
                    "config_path", self.default_git.config_path
                ),
                "sync_interval": settings.get(
                    "sync_interval", self.default_git.sync_interval
                ),
                "verify_ssl": settings.get("verify_ssl", self.default_git.verify_ssl),
            }
            if existing:
                repo.update(existing.id, **kwargs)
            else:
                repo.create(**kwargs)
            logger.info("Git settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Git settings: %s", e)
            return False

    def update_all_settings(self, settings: Dict[str, Any]) -> bool:
        success = True
        if "git" in settings:
            success &= self.update_git_settings(settings["git"])
        if "cache" in settings:
            success &= self.update_cache_settings(settings["cache"])
        if "celery" in settings:
            success &= self.update_celery_settings(settings["celery"])
        return success

    def _get_metadata(self) -> Dict[str, Any]:
        try:
            repo = SettingsMetadataRepository()
            schema_version = repo.get_by_key("schema_version")
            return {
                "schema_version": schema_version.value if schema_version else "1.0",
                "database_type": "postgresql",
            }
        except Exception as e:
            logger.error("Error getting metadata: %s", e)
            return {"error": str(e)}

    def reset_to_defaults(self) -> bool:
        try:
            GitSettingRepository().delete_all()
            CacheSettingRepository().delete_all()
            CelerySettingRepository().delete_all()
            logger.info("Settings reset to defaults")
            return True
        except Exception as e:
            logger.error("Error resetting settings: %s", e)
            return False

    def health_check(self) -> Dict[str, Any]:
        try:
            git_repo = GitSettingRepository()
            cache_repo = CacheSettingRepository()
            celery_repo = CelerySettingRepository()
            return {
                "status": "healthy",
                "database_type": "postgresql",
                "git_settings_count": 1 if git_repo.get_settings() else 0,
                "cache_settings_count": 1 if cache_repo.get_settings() else 0,
                "celery_settings_count": 1 if celery_repo.get_settings() else 0,
            }
        except Exception as e:
            logger.error("Database health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e), "recovery_needed": False}

    def get_selected_git_repository(self) -> Optional[int]:
        try:
            repo = SettingsMetadataRepository()
            result = repo.get_by_key("selected_git_repository")
            return int(result.value) if result and result.value else None
        except Exception as e:
            logger.error("Error getting selected Git repository: %s", e)
            return None

    def set_selected_git_repository(self, repository_id: int) -> bool:
        try:
            repo = SettingsMetadataRepository()
            repo.set_metadata("selected_git_repository", str(repository_id))
            logger.info("Selected Git repository set to ID: %s", repository_id)
            return True
        except Exception as e:
            logger.error("Error setting selected Git repository: %s", e)
            return False


# Module-level singleton for backward compatibility
settings_service = SettingsService()
