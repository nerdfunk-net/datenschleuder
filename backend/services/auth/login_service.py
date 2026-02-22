"""
Shared helpers for building authentication responses.

Extracted from routers/auth/auth.py and routers/auth/oidc.py to eliminate
duplicated RBAC role-resolution and user-response-building logic that was
present across the login, token-refresh, and OIDC-callback endpoints.
"""

from __future__ import annotations
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Priority-ordered list used to pick the primary (legacy) role shown to the frontend.
_ROLE_PRIORITY = ["admin", "operator", "network_engineer", "viewer"]


def resolve_primary_role(
    role_names: list[str], default: Optional[str] = None
) -> Optional[str]:
    """Return the highest-priority role name, or *default* when none match."""
    for role in _ROLE_PRIORITY:
        if role in role_names:
            return role
    if role_names:
        return role_names[0]
    return default


def get_user_with_rbac_safe(user: dict) -> dict:
    """Fetch RBAC data for *user* and return a merged dict.

    Falls back to empty roles/permissions when the RBAC lookup returns None,
    so callers never need to handle the None case themselves.
    """
    import rbac_manager as rbac

    user_with_roles = rbac.get_user_with_rbac(user["id"])
    if not user_with_roles:
        logger.warning(
            "get_user_with_rbac returned None for user_id=%s, using base user",
            user["id"],
        )
        user_with_roles = dict(user)
        user_with_roles.setdefault("roles", [])
        user_with_roles.setdefault("permissions", [])
    return user_with_roles


def build_user_response(
    user_with_roles: dict, default_role: Optional[str] = None
) -> dict:
    """Build the user sub-object returned inside LoginResponse.

    Args:
        user_with_roles: Dict returned by get_user_with_rbac_safe().
        default_role:    Value for the legacy ``role`` field when no recognised
                         role is found (None for password/API-key login,
                         "user" for OIDC login).
    """
    role_names = [r["name"] for r in user_with_roles.get("roles", [])]
    primary_role = resolve_primary_role(role_names, default=default_role)
    return {
        "id": user_with_roles["id"],
        "username": user_with_roles["username"],
        "realname": user_with_roles["realname"],
        "email": user_with_roles.get("email"),
        "role": primary_role,
        "roles": role_names,
        "permissions": user_with_roles.get("permissions", []),
        "debug": user_with_roles.get("debug", False),
    }
