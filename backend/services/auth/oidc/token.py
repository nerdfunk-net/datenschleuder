"""OIDC token operations: authorization URL generation, code exchange."""

from __future__ import annotations

import logging
import secrets
import ssl
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, status

from models.auth import OIDCConfig

logger = logging.getLogger(__name__)


def generate_state() -> str:
    """Generate a secure random state parameter for CSRF protection."""
    return secrets.token_urlsafe(32)


def build_authorization_url(
    provider_id: str,
    config: OIDCConfig,
    state: str,
    provider_config: Dict[str, Any],
    redirect_uri: Optional[str] = None,
    scopes_override: Optional[List[str]] = None,
    response_type_override: Optional[str] = None,
    client_id_override: Optional[str] = None,
) -> str:
    """Generate the authorization URL for OIDC login.

    Args:
        provider_id: OIDC provider identifier.
        config: Fetched OIDC discovery config.
        state: CSRF state token.
        provider_config: Raw provider settings from YAML.
        redirect_uri: Override redirect URI (falls back to provider config).
        scopes_override: Override scopes list.
        response_type_override: Override response_type (default: "code").
        client_id_override: Override client_id (for testing).

    Returns:
        Full authorization URL with query parameters.
    """
    client_id = client_id_override or provider_config.get("client_id")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OIDC provider '{provider_id}' missing required 'client_id' in configuration",
        )

    scopes = scopes_override or provider_config.get("scopes", ["openid", "profile", "email"])
    response_type = response_type_override or "code"

    if not redirect_uri:
        redirect_uri = provider_config.get("redirect_uri")
        if not redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC provider '{provider_id}' missing required 'redirect_uri' in configuration",
            )

    if any([client_id_override, scopes_override, response_type_override]):
        logger.info("[OIDC Test] Generating authorization URL with overrides for '%s'", provider_id)
        if client_id_override:
            logger.info("[OIDC Test] - client_id overridden: %s", client_id_override)
        if scopes_override:
            logger.info("[OIDC Test] - scopes overridden: %s", ", ".join(scopes_override))
        if response_type_override:
            logger.info("[OIDC Test] - response_type overridden: %s", response_type_override)

    params = {
        "client_id": client_id,
        "response_type": response_type,
        "scope": " ".join(scopes),
        "redirect_uri": redirect_uri,
        "state": state,
    }

    query_params = "&".join(
        f"{k}={httpx.URL('').copy_with(params={k: v}).params[k]}"
        for k, v in params.items()
    )
    return f"{config.authorization_endpoint}?{query_params}"


def _sanitize_token_response(token_response: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize token response for logging by masking sensitive tokens."""
    sanitized = token_response.copy()
    for field in ("access_token", "refresh_token", "id_token"):
        if field in sanitized and sanitized[field]:
            token = sanitized[field]
            sanitized[field] = f"{token[:10]}...{token[-10:]}" if len(token) > 20 else "***MASKED***"
    return sanitized


async def exchange_code_for_tokens(
    provider_id: str,
    code: str,
    token_endpoint: str,
    provider_config: Dict[str, Any],
    ssl_context: Optional[ssl.SSLContext],
    redirect_uri: Optional[str] = None,
) -> Dict[str, Any]:
    """Exchange authorization code for tokens.

    Args:
        provider_id: OIDC provider identifier (for error messages).
        code: Authorization code from the callback.
        token_endpoint: Token endpoint URL from OIDC discovery.
        provider_config: Raw provider settings from YAML.
        ssl_context: Custom SSL context (or None for default).
        redirect_uri: Override redirect URI.

    Returns:
        Token response dict.
    """
    client_id = provider_config.get("client_id")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OIDC provider '{provider_id}' missing required 'client_id' in configuration",
        )

    client_secret = provider_config.get("client_secret")
    if not client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OIDC provider '{provider_id}' missing required 'client_secret' in configuration",
        )

    if not redirect_uri:
        redirect_uri = provider_config.get("redirect_uri")
        if not redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC provider '{provider_id}' missing required 'redirect_uri' in configuration",
            )

    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    }

    sanitized = {**token_data, "client_secret": "***MASKED***"}
    if len(sanitized.get("code", "")) > 20:
        c = sanitized["code"]
        sanitized["code"] = f"{c[:10]}...{c[-10:]}"
    logger.debug("Token request to provider '%s': %s", provider_id, sanitized)
    logger.debug("Token endpoint URL: %s", token_endpoint)

    client_kwargs: Dict[str, Any] = {"timeout": 10.0}
    if ssl_context:
        client_kwargs["verify"] = ssl_context

    try:
        async with httpx.AsyncClient(**client_kwargs) as client:
            response = await client.post(
                token_endpoint,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            logger.debug(
                "Token endpoint response status from provider '%s': %s", provider_id, response.status_code
            )
            logger.debug(
                "Token endpoint response headers from provider '%s': %s", provider_id, dict(response.headers)
            )
            response.raise_for_status()
            token_response = response.json()
            logger.debug(
                "Token response from provider '%s': %s",
                provider_id,
                _sanitize_token_response(token_response),
            )
            return token_response

    except httpx.HTTPError as exc:
        logger.error("Token exchange failed for provider '%s': %s", provider_id, exc)
        if hasattr(exc, "response") and exc.response is not None:
            logger.error("Error response status: %s", exc.response.status_code)
            logger.error("Error response body: %s", exc.response.text)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to exchange authorization code for tokens with provider '{provider_id}'",
        ) from exc
