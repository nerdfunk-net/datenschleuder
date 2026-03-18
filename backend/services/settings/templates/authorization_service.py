"""Template authorization service."""

from __future__ import annotations

# Admin permission bit — bit 4 (value 16) in the permissions bitmask.
# TODO: Replace with rbac_service.has_permission() after Phase 2 RBAC service is in place.
_ADMIN_PERMISSION_BIT = 16


class TemplateAuthorizationService:
    """Service for checking template-related permissions."""

    def check_edit_permission(self, current_user: dict, template: dict) -> bool:
        """Return True if current_user may edit the given template.

        Admins can edit any template; regular users can only edit their own.
        """
        username = current_user.get("username")
        is_admin = bool(current_user.get("permissions", 0) & _ADMIN_PERMISSION_BIT)
        return is_admin or template.get("created_by") == username
