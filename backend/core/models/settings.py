"""Settings models: Setting, GitSetting, CacheSetting, CelerySetting, SettingsMetadata."""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from core.database import Base


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(255), nullable=False, index=True)
    key = Column(String(255), nullable=False)
    value = Column(Text)
    value_type = Column(String(50), nullable=False, default="string")
    description = Column(Text)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (UniqueConstraint("category", "key", name="uix_category_key"),)


class GitSetting(Base):
    """Git repository settings for configs."""

    __tablename__ = "git_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_url = Column(String(500), nullable=False)
    branch = Column(String(255), nullable=False, default="main")
    username = Column(String(255))
    token = Column(String(500))
    config_path = Column(String(500), nullable=False, default="configs/")
    sync_interval = Column(Integer, nullable=False, default=15)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CacheSetting(Base):
    """Cache configuration for Git data."""

    __tablename__ = "cache_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    enabled = Column(Boolean, nullable=False, default=True)
    ttl_seconds = Column(Integer, nullable=False, default=600)
    prefetch_on_startup = Column(Boolean, nullable=False, default=True)
    refresh_interval_minutes = Column(
        Integer, nullable=False, default=15
    )  # DEPRECATED: No longer used
    max_commits = Column(Integer, nullable=False, default=500)
    prefetch_items = Column(Text)  # JSON string
    # Cache task intervals (in minutes) - 0 means disabled
    git_commits_cache_interval_minutes = Column(Integer, nullable=False, default=15)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CelerySetting(Base):
    """Celery task queue settings."""

    __tablename__ = "celery_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Worker settings (require restart to take effect)
    max_workers = Column(Integer, nullable=False, default=4)
    # Cleanup settings
    cleanup_enabled = Column(Boolean, nullable=False, default=True)
    cleanup_interval_hours = Column(
        Integer, nullable=False, default=6
    )  # Run cleanup every 6 hours
    cleanup_age_hours = Column(
        Integer, nullable=False, default=24
    )  # Remove data older than 24 hours
    # Result expiry
    result_expires_hours = Column(Integer, nullable=False, default=24)
    # Queue configuration - stores list of configured queues as JSON
    # Format: [{"name": "backup", "description": "Backup queue for device configs"}, ...]
    queues = Column(Text, nullable=True)  # JSON array of queue objects
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class RedisServer(Base):
    """Redis server connection configuration."""

    __tablename__ = "redis_servers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, default=6379)
    use_tls = Column(Boolean, nullable=False, default=False)
    db_index = Column(Integer, nullable=False, default=0)
    password = Column(String(500), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SettingsMetadata(Base):
    """Settings metadata for versioning and status."""

    __tablename__ = "settings_metadata"

    key = Column(String(255), primary_key=True)
    value = Column(Text)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
