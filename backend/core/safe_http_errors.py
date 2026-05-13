"""
Safe HTTP error helpers that prevent raw exception text from reaching API clients.

5xx responses (and sanitized gateway errors) must never include exception text,
stack traces, SQL fragments, hostnames, or library internals. This module provides
a single implementation point for that policy.

Usage:
    from core.safe_http_errors import raise_internal_server_error

    try:
        result = some_operation()
    except Exception as e:
        raise_internal_server_error(log_message="Failed to do X", exc=e, operation="do_x")

The caller receives: {"detail": {"message": "Failed to do X", "error_id": "<uuid>"}}
The full traceback is in the application log under the same error_id.
"""

import logging
import uuid
from typing import NoReturn

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def generate_error_id() -> str:
    """Return a random opaque identifier for correlating log entries with error responses."""
    return uuid.uuid4().hex


def raise_internal_server_error(
    *,
    log_message: str,
    exc: BaseException | None = None,
    status_code: int = 500,
    operation: str | None = None,
) -> NoReturn:
    """Log a server-side error and raise an HTTPException with sanitized detail.

    The HTTP response body contains only {message, error_id}.
    Full exception context (traceback, exc args) stays in the log.

    Args:
        log_message: Human-safe description logged and sent to the client.
            Must not contain raw exception text or internal paths.
        exc: The caught exception — used for exc_info logging only, never
            forwarded to the client.
        status_code: HTTP status code (default 500). Pass 502/503/504 for
            sanitized gateway-class errors.
        operation: Short identifier (e.g. "list_job_runs") added to the log
            record's extra dict for structured querying.
    """
    error_id = generate_error_id()
    extra: dict[str, str] = {"error_id": error_id}
    if operation:
        extra["operation"] = operation

    if exc is not None:
        logger.error(log_message, exc_info=True, extra=extra)
    else:
        logger.error(log_message, extra=extra)

    raise HTTPException(
        status_code=status_code,
        detail={"message": log_message, "error_id": error_id},
    )
