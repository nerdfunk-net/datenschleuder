"""Audit service — owns all audit log writes for auth events."""

import logging
from typing import Optional

from repositories.audit_log_repository import audit_log_repo

logger = logging.getLogger(__name__)


def record_login_success(
    username: str,
    user_id: int,
    authentication_method: str,
    extra_data: Optional[dict] = None,
) -> None:
    """Record a successful login event."""
    payload: dict = {"authentication_method": authentication_method}
    if extra_data:
        payload.update(extra_data)
    try:
        audit_log_repo.create_log(
            username=username,
            user_id=user_id,
            event_type="login",
            message=f"User '{username}' logged in",
            resource_type="authentication",
            resource_id=str(user_id),
            resource_name=username,
            severity="info",
            extra_data=payload,
        )
    except Exception as exc:
        logger.error("Failed to record login audit event for user %s: %s", username, exc)


def record_oidc_login_success(
    username: str,
    user_id: int,
    provider_id: str,
    roles: list,
    is_new_user: bool,
) -> None:
    """Record a successful OIDC login event."""
    try:
        audit_log_repo.create_log(
            username=username,
            user_id=user_id,
            event_type="login",
            message=f"User '{username}' logged in via OIDC",
            resource_type="authentication",
            resource_id=str(user_id),
            resource_name=username,
            severity="info",
            extra_data={
                "authentication_method": "oidc",
                "oidc_provider": provider_id,
                "roles": roles,
                "is_new_user": is_new_user,
            },
        )
    except Exception as exc:
        logger.error(
            "Failed to record OIDC login audit event for user %s: %s", username, exc
        )


def record_logout(username: str, user_id: Optional[int]) -> None:
    """Record a logout event."""
    try:
        audit_log_repo.create_log(
            username=username,
            user_id=user_id,
            event_type="logout",
            message=f"User '{username}' logged out",
            resource_type="authentication",
            resource_id=str(user_id),
            resource_name=username,
            severity="info",
        )
    except Exception as exc:
        logger.error("Failed to record logout audit event for user %s: %s", username, exc)
