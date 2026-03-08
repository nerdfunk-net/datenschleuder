"""
FastAPI dependency providers — FastAPI Depends() wrappers only.

Rules:
  - This file ONLY imports from fastapi, service_factory, and type hints.
  - It is imported exclusively by router modules.
  - Celery tasks MUST NOT import from this file; they use service_factory directly.
  - App-scoped services are retrieved from request.app.state (set during lifespan).
  - Request-scoped services are constructed fresh per request via service_factory.

Usage in a router::

    from dependencies import get_encryption_service, get_oidc_service, get_cache_service
    from services.nifi.encryption import EncryptionService

    @router.get("/example")
    async def example(
        enc: EncryptionService = Depends(get_encryption_service),
    ):
        ...
"""

from __future__ import annotations

from fastapi import Request
import service_factory


# ---------------------------------------------------------------------------
# App-scoped providers (read from app.state — set during lifespan in main.py)
# ---------------------------------------------------------------------------


def get_encryption_service(request: Request):
    """Return the app-scoped EncryptionService stored on app.state."""
    return request.app.state.encryption_service


def get_oidc_service(request: Request):
    """Return the app-scoped OIDCService stored on app.state."""
    return request.app.state.oidc_service


def get_cache_service(request: Request):
    """Return the app-scoped RedisCacheService stored on app.state."""
    return request.app.state.cache_service


# ---------------------------------------------------------------------------
# Request-scoped providers (constructed fresh per request)
# ---------------------------------------------------------------------------


def get_nifi_connection_service():
    """Return a new NifiConnectionService for each request.

    NifiConnectionService mutates nipyapi global state, so it must not be shared
    between concurrent requests. The nipyapi race condition is handled separately
    in services/nifi/nifi_context.py via a process-level lock + context manager.
    """
    return service_factory.build_nifi_connection_service()


def get_git_service():
    """Return a GitService instance.

    GitService is stateless; a fresh instance per request is fine.
    """
    return service_factory.build_git_service()


def get_git_auth_service():
    """Return a GitAuthenticationService instance."""
    return service_factory.build_git_auth_service()


def get_git_operations_service():
    """Return a GitOperationsService instance."""
    return service_factory.build_git_operations_service()


def get_git_connection_service():
    """Return a GitConnectionService instance."""
    return service_factory.build_git_connection_service()


def get_git_diff_service():
    """Return a GitDiffService instance."""
    return service_factory.build_git_diff_service()


def get_git_cache_service(request: Request):
    """Return a GitCacheService backed by the app-scoped cache."""
    return service_factory.build_git_cache_service(
        cache_service=request.app.state.cache_service
    )


# ---------------------------------------------------------------------------
# App-scoped providers — certificate & settings managers
# ---------------------------------------------------------------------------


def get_certificate_manager(request: Request):
    """Return the app-scoped CertificateManager stored on app.state."""
    return request.app.state.certificate_manager


def get_nifi_oidc_config(request: Request):
    """Return the app-scoped NifiOidcConfigManager stored on app.state."""
    return request.app.state.nifi_oidc_config


def get_settings_manager(request: Request):
    """Return the app-scoped SettingsManager stored on app.state."""
    return request.app.state.settings_manager


# ---------------------------------------------------------------------------
# Request-scoped providers — git repository manager
# ---------------------------------------------------------------------------


def get_git_repo_manager():
    """Return a new GitRepositoryManager for each request.

    GitRepositoryManager is stateless; a fresh instance per request is safe.
    """
    return service_factory.build_git_repo_manager()
