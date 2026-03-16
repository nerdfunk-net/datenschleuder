"""OIDC user data extraction and auto-provisioning."""

from __future__ import annotations

import logging
import secrets
from typing import Any, Dict, Tuple

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def extract_user_data(
    provider_id: str,
    claims: Dict[str, Any],
    provider_config: Dict[str, Any],
) -> Dict[str, Any]:
    """Extract user data from OIDC claims using provider-specific claim mappings.

    Args:
        provider_id: OIDC provider identifier (for error messages).
        claims: Decoded ID token claims.
        provider_config: Raw provider settings from YAML.

    Returns:
        dict with username, email, realname, sub, provider_id.
    """
    logger.debug(
        "[OIDC Debug] Extracting user data from claims for provider '%s'", provider_id
    )

    claim_mappings = provider_config.get("claim_mappings", {})
    username_claim = claim_mappings.get("username", "preferred_username")
    email_claim = claim_mappings.get("email", "email")
    name_claim = claim_mappings.get("name", "name")

    logger.debug(
        "[OIDC Debug] Available claims in ID token from '%s': %s",
        provider_id,
        list(claims.keys()),
    )
    logger.debug(
        "[OIDC Debug] Claim mappings - username: %s, email: %s, name: %s",
        username_claim,
        email_claim,
        name_claim,
    )

    username = claims.get(username_claim)
    email = claims.get(email_claim)
    name = claims.get(name_claim, username)

    logger.debug("[OIDC Debug] Extracted username: %s", username)
    logger.debug("[OIDC Debug] Extracted email: %s", email)
    logger.debug("[OIDC Debug] Extracted name: %s", name)

    if not username:
        logger.error(
            "Username claim '%s' not found in token from provider '%s'",
            username_claim,
            provider_id,
        )
        logger.error("Available claims: %s", claims)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Username claim '{username_claim}' not found in token from provider '{provider_id}'",
        )

    logger.info(
        "Extracted user data from provider '%s': username=%s, email=%s, name=%s",
        provider_id,
        username,
        email,
        name,
    )

    return {
        "username": username,
        "email": email,
        "realname": name,
        "sub": claims.get("sub"),
        "provider_id": provider_id,
    }


async def provision_or_get_user(
    provider_id: str,
    user_data: Dict[str, Any],
    provider_config: Dict[str, Any],
) -> Tuple[Dict[str, Any], bool]:
    """Provision a new user or return an existing user from OIDC data.

    Args:
        provider_id: OIDC provider identifier.
        user_data: Extracted user data (from extract_user_data).
        provider_config: Raw provider settings from YAML.

    Returns:
        (user_dict, is_new_user) tuple.
    """
    logger.debug(
        "[OIDC Debug] Provisioning or retrieving user from provider '%s'", provider_id
    )
    logger.debug("[OIDC Debug] Username: %s", user_data.get("username"))
    logger.debug("[OIDC Debug] Email: %s", user_data.get("email"))
    logger.debug("[OIDC Debug] Subject (sub): %s", user_data.get("sub"))

    # Check if auto-provisioning is enabled (default to True for backward compatibility)
    auto_provision_config = provider_config.get("auto_provision")
    auto_provision = (
        True if auto_provision_config is None else bool(auto_provision_config)
    )

    from services.auth.user_management import (
        create_user,
        get_user_by_username,
        update_user,
    )
    from models.user_management import UserRole

    username = user_data["username"]
    user = get_user_by_username(username)

    if user:
        updates = {}
        if user_data.get("email") and user.get("email") != user_data["email"]:
            updates["email"] = user_data["email"]
        if user_data.get("realname") and user.get("realname") != user_data["realname"]:
            updates["realname"] = user_data["realname"]

        if updates:
            user = update_user(user["id"], **updates)
            logger.info(
                "[OIDC Debug] Updated user '%s' information from provider '%s'",
                username,
                provider_id,
            )
        else:
            logger.info(
                "[OIDC Debug] Existing user '%s' logged in via OIDC provider '%s'",
                username,
                provider_id,
            )

        logger.debug(
            "[OIDC Debug] User ID: %s, is_active: %s, role: %s",
            user["id"],
            user.get("is_active", True),
            user.get("role", "unknown"),
        )
        return user, False

    if not auto_provision:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User does not exist and auto-provisioning is disabled for provider '{provider_id}'",
        )

    try:
        random_password = secrets.token_urlsafe(32)
        default_role_str = provider_config.get("default_role", "user")
        default_role = UserRole.user if default_role_str == "user" else UserRole.admin

        user = create_user(
            username=username,
            realname=user_data.get("realname", username),
            password=random_password,
            email=user_data.get("email"),
            role=default_role,
            debug=False,
            is_active=False,  # New OIDC users start as inactive
        )

        logger.info(
            "Auto-provisioned new INACTIVE OIDC user '%s' from provider '%s' — requires admin approval",
            username,
            provider_id,
        )
        return user, True

    except Exception as exc:
        logger.error(
            "Failed to provision OIDC user from provider '%s': %s", provider_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provision user account from provider '{provider_id}'",
        ) from exc
