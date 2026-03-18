"""OIDCService facade — orchestrates discovery, token, JWKS, and provisioning sub-modules."""

from __future__ import annotations

import logging
import ssl
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from models.auth import OIDCConfig
from services.auth.oidc.discovery import build_ssl_context, fetch_oidc_config
from services.auth.oidc.jwks import fetch_jwks, verify_id_token as _verify_id_token
from services.auth.oidc.token import (
    build_authorization_url,
    exchange_code_for_tokens as _exchange_code,
    generate_state,
)
from services.auth.oidc.user_provisioning import (
    extract_user_data as _extract_user_data,
    provision_or_get_user as _provision_or_get_user,
)

logger = logging.getLogger(__name__)


class OIDCService:
    """Service for OIDC authentication operations supporting multiple providers."""

    def __init__(self, settings_manager=None) -> None:
        if settings_manager is None:
            from services.settings.settings_service import settings_service as _sm

            settings_manager = _sm
        self._settings_manager = settings_manager
        # Cache per provider: {provider_id: config}
        self._configs: Dict[str, OIDCConfig] = {}
        # Provider config loaded once from YAML at startup; refreshed by reload()
        self._provider_configs: Dict[str, Dict[str, Any]] = {}
        self._provider_configs_loaded = False
        # JWKS cache per provider: {provider_id: jwks}
        self._jwks_caches: Dict[str, Dict[str, Any]] = {}
        self._jwks_cache_times: Dict[str, datetime] = {}
        self._jwks_cache_ttl = timedelta(hours=1)
        # SSL context cache per provider
        self._ssl_contexts: Dict[str, ssl.SSLContext] = {}

    # ------------------------------------------------------------------
    # Provider config (load-once pattern from Phase 4b)
    # ------------------------------------------------------------------

    def _load_provider_configs(self) -> None:
        """Load all OIDC provider configs from settings into memory."""
        providers = self._settings_manager.get_oidc_providers()
        self._provider_configs = {
            pid: {**cfg, "provider_id": pid} for pid, cfg in providers.items()
        }
        self._provider_configs_loaded = True
        logger.info("Loaded %d OIDC provider config(s)", len(self._provider_configs))

    def reload(self) -> None:
        """Reload OIDC provider configs from disk and clear derived caches."""
        self._provider_configs_loaded = False
        self._ssl_contexts.clear()
        self._jwks_caches.clear()
        self._jwks_cache_times.clear()
        self._load_provider_configs()

    def _get_provider_config(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """Return provider config from in-memory cache, loading on first access."""
        if not self._provider_configs_loaded:
            self._load_provider_configs()
        provider = self._provider_configs.get(provider_id)
        if not provider:
            logger.warning("OIDC provider '%s' not found in config", provider_id)
        return provider

    # ------------------------------------------------------------------
    # SSL context (per-provider, cached)
    # ------------------------------------------------------------------

    def _get_ssl_context(self, provider_id: str) -> Optional[ssl.SSLContext]:
        """Get or create SSL context with custom CA certificate for the provider."""
        if provider_id in self._ssl_contexts:
            return self._ssl_contexts[provider_id]

        provider_config = self._get_provider_config(provider_id)
        if not provider_config:
            return None

        ctx = build_ssl_context(provider_config, provider_id)
        if ctx is not None:
            self._ssl_contexts[provider_id] = ctx
        return ctx

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    async def get_oidc_config(self, provider_id: str) -> OIDCConfig:
        """Fetch OIDC configuration from discovery endpoint for a specific provider."""
        if not self._settings_manager.is_oidc_enabled():
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="OIDC authentication is not enabled",
            )

        provider_config = self._get_provider_config(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        if not provider_config.get("enabled", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"OIDC provider '{provider_id}' is not enabled",
            )

        discovery_url = provider_config.get("discovery_url")
        if not discovery_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC discovery URL not configured for provider '{provider_id}'",
            )

        if provider_id in self._configs:
            return self._configs[provider_id]

        ssl_context = self._get_ssl_context(provider_id)
        config = await fetch_oidc_config(provider_id, discovery_url, ssl_context)
        self._configs[provider_id] = config
        return config

    # ------------------------------------------------------------------
    # Token operations
    # ------------------------------------------------------------------

    def generate_state(self) -> str:
        """Generate a secure random state parameter for CSRF protection."""
        return generate_state()

    def generate_authorization_url(
        self,
        provider_id: str,
        config: OIDCConfig,
        state: str,
        redirect_uri: Optional[str] = None,
        scopes_override: Optional[List[str]] = None,
        response_type_override: Optional[str] = None,
        client_id_override: Optional[str] = None,
    ) -> str:
        """Generate the authorization URL for OIDC login."""
        provider_config = self._get_provider_config(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )
        return build_authorization_url(
            provider_id=provider_id,
            config=config,
            state=state,
            provider_config=provider_config,
            redirect_uri=redirect_uri,
            scopes_override=scopes_override,
            response_type_override=response_type_override,
            client_id_override=client_id_override,
        )

    async def exchange_code_for_tokens(
        self, provider_id: str, code: str, redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        config = await self.get_oidc_config(provider_id)
        provider_config = self._get_provider_config(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )
        ssl_context = self._get_ssl_context(provider_id)
        return await _exchange_code(
            provider_id=provider_id,
            code=code,
            token_endpoint=config.token_endpoint,
            provider_config=provider_config,
            ssl_context=ssl_context,
            redirect_uri=redirect_uri,
        )

    # ------------------------------------------------------------------
    # JWKS and token verification
    # ------------------------------------------------------------------

    async def get_jwks(self, provider_id: str) -> Dict[str, Any]:
        """Fetch and cache JWKS from the OIDC provider."""
        if (
            provider_id in self._jwks_caches
            and provider_id in self._jwks_cache_times
            and datetime.now(timezone.utc) - self._jwks_cache_times[provider_id]
            < self._jwks_cache_ttl
        ):
            return self._jwks_caches[provider_id]

        config = await self.get_oidc_config(provider_id)
        ssl_context = self._get_ssl_context(provider_id)
        jwks = await fetch_jwks(provider_id, config.jwks_uri, ssl_context)
        self._jwks_caches[provider_id] = jwks
        self._jwks_cache_times[provider_id] = datetime.now(timezone.utc)
        return jwks

    async def verify_id_token(self, provider_id: str, id_token: str) -> Dict[str, Any]:
        """Verify and decode ID token from OIDC provider."""
        config = await self.get_oidc_config(provider_id)
        jwks = await self.get_jwks(provider_id)

        provider_config = self._get_provider_config(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        client_id = provider_config.get("client_id")
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC provider '{provider_id}' missing required 'client_id' in configuration",
            )

        return _verify_id_token(provider_id, id_token, config, jwks, client_id)

    async def get_user_info(
        self, provider_id: str, access_token: str
    ) -> Dict[str, Any]:
        """Fetch user information from the userinfo endpoint."""
        import httpx

        config = await self.get_oidc_config(provider_id)
        ssl_context = self._get_ssl_context(provider_id)

        client_kwargs: Dict[str, Any] = {"timeout": 10.0}
        if ssl_context:
            client_kwargs["verify"] = ssl_context

        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.get(
                    config.userinfo_endpoint,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as exc:
            logger.error(
                "Failed to fetch user info from provider '%s': %s", provider_id, exc
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to fetch user information from provider '{provider_id}'",
            ) from exc

    # ------------------------------------------------------------------
    # User data extraction and provisioning
    # ------------------------------------------------------------------

    def extract_user_data(
        self, provider_id: str, claims: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract user data from OIDC claims using provider-specific claim mappings."""
        provider_config = self._get_provider_config(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )
        return _extract_user_data(provider_id, claims, provider_config)

    async def provision_or_get_user(
        self, provider_id: str, user_data: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], bool]:
        """Provision a new user or get existing user from OIDC data."""
        provider_config = self._get_provider_config(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )
        return await _provision_or_get_user(provider_id, user_data, provider_config)
