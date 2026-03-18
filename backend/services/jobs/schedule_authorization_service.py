"""Job Schedule Authorization Service.

Centralizes permission checks for job schedule CRUD and execution operations.
De-duplicates the check pattern that appeared 3 times in the schedules router.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class JobScheduleAuthorizationService:
    """Service for checking job schedule permissions."""

    def __init__(self):
        from services.auth.rbac_service import RBACService
        self._rbac = RBACService()

    def _is_admin(self, current_user: dict) -> bool:
        return current_user.get("role") == "admin"

    def _has_permission(self, current_user: dict, resource: str, action: str) -> bool:
        return self._rbac.has_permission(current_user["user_id"], resource, action)

    def check_create_permission(self, current_user: dict, is_global: bool) -> None:
        """Raise 403 if user cannot create the requested schedule type.

        Global schedules require jobs.schedules:write or admin role.
        Private schedules are allowed for any authenticated user.
        """
        if is_global:
            if not (self._is_admin(current_user) or self._has_permission(current_user, "jobs.schedules", "write")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs.schedules:write required for global schedules",
                )

    def check_update_permission(self, current_user: dict, job: dict) -> None:
        """Raise 403 if user cannot update the given schedule."""
        is_owner = job.get("user_id") == current_user["user_id"]
        if not (
            self._is_admin(current_user)
            or self._has_permission(current_user, "jobs.schedules", "write")
            or is_owner
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: jobs.schedules:write required to edit this schedule",
            )

    def check_delete_permission(self, current_user: dict, job: dict) -> None:
        """Raise 403 if user cannot delete the given schedule."""
        is_owner = job.get("user_id") == current_user["user_id"]
        if not (
            self._is_admin(current_user)
            or self._has_permission(current_user, "jobs.schedules", "delete")
            or is_owner
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: jobs.schedules:delete required to delete this schedule",
            )

    def check_access_permission(self, current_user: dict, job: dict) -> None:
        """Raise 403 if user cannot access (read/execute) the given schedule.

        Private schedules are only accessible to their owner.
        """
        if not job.get("is_global") and job.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: This is a private job belonging to another user",
            )
