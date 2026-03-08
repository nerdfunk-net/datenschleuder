"""Shared openssl subprocess wrapper used by all cert-manager modules."""

from __future__ import annotations

import subprocess

from fastapi import HTTPException, status


def _run_openssl_check(*args: str) -> subprocess.CompletedProcess:
    """Run openssl and raise HTTPException on failure."""
    try:
        result = subprocess.run(
            ["openssl", *args],
            capture_output=True,
            timeout=60,
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="openssl binary not found on the server.",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="openssl operation timed out.",
        ) from exc
