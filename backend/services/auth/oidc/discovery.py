"""OIDC discovery: fetch and cache OpenID Connect configuration from provider endpoints."""

from __future__ import annotations

import logging
import ssl
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status

from models.auth import OIDCConfig

logger = logging.getLogger(__name__)


def build_ssl_context(
    provider_config: Dict[str, Any], provider_id: str
) -> Optional[ssl.SSLContext]:
    """Create an SSL context with a custom CA certificate for the provider.

    Returns None if no custom CA is configured or the file is missing.
    """
    ca_cert_path = provider_config.get("ca_cert_path")
    if not ca_cert_path:
        return None

    ca_cert_file = Path(ca_cert_path)
    if not ca_cert_file.is_absolute():
        # Relative to project root (three levels up from this file)
        ca_cert_file = Path(__file__).parent.parent.parent.parent / ca_cert_path

    if not ca_cert_file.exists():
        logger.warning(
            "CA certificate not found for provider '%s': %s", provider_id, ca_cert_file
        )
        return None

    try:
        ssl_context = ssl.create_default_context()
        ssl_context.load_verify_locations(cafile=str(ca_cert_file))
        logger.info(
            "Loaded custom CA certificate for provider '%s': %s",
            provider_id,
            ca_cert_file,
        )
        return ssl_context
    except Exception as exc:
        logger.error(
            "Failed to load CA certificate for provider '%s': %s", provider_id, exc
        )
        return None


async def fetch_oidc_config(
    provider_id: str,
    discovery_url: str,
    ssl_context: Optional[ssl.SSLContext],
) -> OIDCConfig:
    """Fetch the OpenID Connect discovery document from the provider.

    Raises HTTPException on network or parsing errors.
    """
    client_kwargs: Dict[str, Any] = {"timeout": 10.0}
    if ssl_context:
        client_kwargs["verify"] = ssl_context
        logger.debug("Using custom CA certificate for provider '%s'", provider_id)

    try:
        async with httpx.AsyncClient(**client_kwargs) as client:
            response = await client.get(discovery_url)
            response.raise_for_status()
            config_data = response.json()

        config = OIDCConfig(**config_data)
        logger.info(
            "Loaded OIDC config for provider '%s' from %s", provider_id, discovery_url
        )
        return config

    except httpx.HTTPError as exc:
        logger.error(
            "Failed to fetch OIDC configuration for '%s': %s", provider_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to connect to OIDC provider '{provider_id}'",
        ) from exc
    except Exception as exc:
        logger.error("Error parsing OIDC configuration for '%s': %s", provider_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid OIDC provider configuration for '{provider_id}'",
        ) from exc
