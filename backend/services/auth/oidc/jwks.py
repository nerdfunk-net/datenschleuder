"""OIDC JWKS fetching and ID token verification."""

from __future__ import annotations

import logging
import ssl
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from models.auth import OIDCConfig

logger = logging.getLogger(__name__)


async def fetch_jwks(
    provider_id: str,
    jwks_uri: str,
    ssl_context: Optional[ssl.SSLContext],
) -> Dict[str, Any]:
    """Fetch the JWKS document from the provider.

    Args:
        provider_id: OIDC provider identifier (for error messages).
        jwks_uri: JWKS URI from the OIDC discovery document.
        ssl_context: Custom SSL context (or None for default).

    Returns:
        JWKS dict.
    """
    client_kwargs: Dict[str, Any] = {"timeout": 10.0}
    if ssl_context:
        client_kwargs["verify"] = ssl_context

    try:
        async with httpx.AsyncClient(**client_kwargs) as client:
            response = await client.get(jwks_uri)
            response.raise_for_status()
            jwks = response.json()

        logger.debug("JWKS fetched for provider '%s'", provider_id)
        return jwks

    except httpx.HTTPError as exc:
        logger.error("Failed to fetch JWKS for provider '%s': %s", provider_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch OIDC signing keys from provider '{provider_id}'",
        ) from exc


def verify_id_token(
    provider_id: str,
    id_token: str,
    config: OIDCConfig,
    jwks: Dict[str, Any],
    client_id: str,
) -> Dict[str, Any]:
    """Verify and decode an ID token.

    Args:
        provider_id: OIDC provider identifier (for error messages).
        id_token: Raw ID token string.
        config: OIDC discovery config (provides issuer).
        jwks: JWKS document for signature verification.
        client_id: Expected audience (client_id).

    Returns:
        Decoded token claims dict.
    """
    logger.debug("[OIDC Debug] Verifying ID token for provider '%s'", provider_id)
    logger.debug("[OIDC Debug] Issuer: %s", config.issuer)
    logger.debug("[OIDC Debug] Client ID (audience): %s", client_id)

    try:
        unverified_header = jwt.get_unverified_header(id_token)
        algorithm = unverified_header.get("alg")
        kid = unverified_header.get("kid")

        logger.debug("[OIDC Debug] ID token algorithm: %s", algorithm)
        logger.debug("[OIDC Debug] ID token key ID (kid): %s", kid)

        key = next(
            (k for k in jwks.get("keys", []) if k.get("kid") == kid),
            None,
        )
        if not key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unable to find matching signing key for provider '{provider_id}'",
            )

        logger.debug("[OIDC Debug] Found matching key in JWKS")

        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256", "RS384", "RS512"],
            audience=client_id,
            issuer=config.issuer,
            options={"verify_at_hash": False},
        )

        logger.debug("[OIDC Debug] ID token verified successfully")
        logger.debug("[OIDC Debug] Token claims: %s", list(claims.keys()))
        logger.debug("[OIDC Debug] Subject (sub): %s", claims.get("sub"))
        logger.debug("[OIDC Debug] Issued at (iat): %s", claims.get("iat"))
        logger.debug("[OIDC Debug] Expires at (exp): %s", claims.get("exp"))

        return claims

    except JWTError as exc:
        logger.error(
            "ID token verification failed for provider '%s': %s", provider_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid ID token from provider '{provider_id}'",
        ) from exc
