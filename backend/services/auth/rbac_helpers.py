"""RBAC helper utilities.

Centralizes repeated access control and permission source determination patterns
from the RBAC router.
"""

from __future__ import annotations

from fastapi import HTTPException, status


def verify_user_access(
    current_user: dict,
    target_user_id: int,
    rbac_service,
    detail: str = "Can only access your own data",
) -> None:
    """Raise 403 unless current_user owns the target resource or is an admin.

    Args:
        current_user: Authenticated user dict (must contain ``user_id``).
        target_user_id: ID of the user whose data is being accessed.
        rbac_service: RBACService instance used to look up roles.
        detail: 403 error message (default is generic).
    """
    if current_user["user_id"] == target_user_id:
        return
    user_roles = rbac_service.get_user_roles(current_user["user_id"])
    if not any(role["name"] == "admin" for role in user_roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def check_permission_with_source(
    rbac_service,
    user_id: int,
    resource: str,
    action: str,
) -> dict:
    """Check whether a user has a permission and determine its source.

    Args:
        rbac_service: RBACService instance.
        user_id: Target user ID.
        resource: Permission resource string (e.g. "jobs.runs").
        action: Permission action string (e.g. "read").

    Returns:
        Dict with keys: has_permission, resource, action, source.
        ``source`` is "override", "role", or None.
    """
    has_perm = rbac_service.has_permission(user_id, resource, action)
    source = None
    if has_perm:
        overrides = rbac_service.get_user_permission_overrides(user_id)
        if any(
            p["resource"] == resource and p["action"] == action and p["granted"]
            for p in overrides
        ):
            source = "override"
        else:
            source = "role"

    return {
        "has_permission": has_perm,
        "resource": resource,
        "action": action,
        "source": source,
    }
