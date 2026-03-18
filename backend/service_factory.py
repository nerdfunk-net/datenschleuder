"""
Service factory — plain factory functions for building service instances.

No FastAPI imports. No global state. Used by:
  - backend/dependencies.py   (which wraps these in FastAPI Depends() providers)
  - Celery tasks              (which call build_*() at task entry points)
  - main.py lifespan          (which stores app-scoped services on app.state)

Construction order for services with dependencies:
  EncryptionService (no deps)
    → NifiConnectionService (needs encryption_service)
  OIDCService (no deps)
  RedisCacheService (no deps)
  GitService (no deps)
  GitAuthenticationService (no deps)
  GitCacheService (needs cache_service)
  GitOperationsService (no deps)
  GitConnectionService (no deps)
  GitDiffService (no deps)
"""

from __future__ import annotations
import logging

logger = logging.getLogger(__name__)


def build_encryption_service():
    """Build a new EncryptionService using the application SECRET_KEY."""
    from services.nifi.encryption import EncryptionService

    return EncryptionService()


def build_oidc_service():
    """Build a new OIDCService (app-scoped: holds JWKS cache and SSL contexts)."""
    from services.auth.oidc import OIDCService

    return OIDCService()


def build_nifi_connection_service(encryption_service=None):
    """Build a NifiConnectionService.

    Pass an explicit encryption_service to avoid using the module-level singleton.
    If omitted the singleton from services.nifi.encryption is used (legacy path).
    """
    from services.nifi.connection import NifiConnectionService

    return NifiConnectionService()


def build_cache_service():
    """Build a RedisCacheService.

    Deferred construction prevents import-time crashes when Redis is unavailable.
    """
    from config import settings
    from services.settings.cache import RedisCacheService

    return RedisCacheService(
        redis_url=settings.redis_url,
        key_prefix="datenschleuder-cache",
    )


def build_git_service():
    """Build a GitService instance."""
    from services.settings.git.service import GitService

    return GitService()


def build_git_auth_service():
    """Build a GitAuthenticationService instance."""
    from services.settings.git.auth import GitAuthenticationService

    return GitAuthenticationService()


def build_git_cache_service(cache_service=None):
    """Build a GitCacheService instance.

    Args:
        cache_service: Optional RedisCacheService to inject. When *None* the
                       instance lazily resolves its own cache on first use.
    """
    from services.settings.git.cache import GitCacheService

    return GitCacheService(cache_service=cache_service)


def build_git_operations_service():
    """Build a GitOperationsService instance."""
    from services.settings.git.operations import GitOperationsService

    return GitOperationsService()


def build_git_connection_service():
    """Build a GitConnectionService instance."""
    from services.settings.git.connection import GitConnectionService

    return GitConnectionService()


def build_git_diff_service():
    """Build a GitDiffService instance."""
    from services.settings.git.diff import GitDiffService

    return GitDiffService()


def build_certificate_manager():
    """Build a new CertificateManager instance."""
    from services.nifi.certificate_manager import CertificateManager

    return CertificateManager()


def build_nifi_oidc_config():
    """Build a NifiOidcConfigManager instance."""
    from services.nifi.oidc_config import NifiOidcConfigManager

    return NifiOidcConfigManager()


def build_settings_manager():
    """Return the app-scoped SettingsService singleton."""
    from services.settings.settings_service import settings_service

    return settings_service


def build_git_repo_manager():
    """Build a new GitRepositoryService instance."""
    from services.settings.git_repository_service import GitRepositoryService

    return GitRepositoryService()
