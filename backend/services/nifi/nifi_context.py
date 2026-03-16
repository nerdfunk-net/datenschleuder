"""
nipyapi connection scope — prevents concurrent FastAPI requests from corrupting
nipyapi's process-global config when targeting different NiFi instances.

Problem
-------
``nipyapi.config.nifi_config`` is a process-global ``Configuration`` object.
``NifiConnectionService.configure_from_instance()`` mutates it before every
NiFi API call. Under FastAPI's async model two concurrent requests targeting
different NiFi instances can call configure back-to-back, leaving the global
config pointing at whichever ran last.

Solution
--------
Two primitives:

1. ``nifi_connection_scope(instance)`` — synchronous context manager that
   saves the connection-relevant nipyapi config attributes, applies the new
   config for ``instance``, executes the body, and restores the original
   config on exit (even on exception).

2. ``with_nifi_instance(instance, sync_operation)`` — async helper for
   FastAPI route handlers. It serialises access to nipyapi's global state
   through a per-process asyncio.Lock, then delegates to
   ``nifi_connection_scope`` for save/restore.

Celery tasks are safe to use ``nifi_connection_scope`` directly without the
lock because Celery runs at most one task per worker process.

pitfalls documented in the refactoring plan
-------------------------------------------
- ``copy.deepcopy(nifi_config)`` crashes — Configuration contains a Logger
  with an ``_thread.RLock``.  We save/restore individual attributes instead.
- ``api_key`` and ``api_key_prefix`` are dicts — a shallow copy is needed.
- ``api_client`` holds cached connections — we set it to ``None`` on restore
  to force nipyapi to rebuild from the restored host and auth settings.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import contextmanager
from typing import Any, Callable, Generator

from nipyapi import config as nipyapi_config

logger = logging.getLogger(__name__)

# One lock per uvicorn worker process.  Multiple uvicorn workers each have
# their own process with their own copy of nipyapi.config, so no cross-process
# coordination is needed.
_nifi_lock: asyncio.Lock = asyncio.Lock()

# Attributes mutated by configure_from_instance() and service_login().
# Dicts (api_key, api_key_prefix) must be shallow-copied; all others are scalars.
_SAVE_ATTRS: tuple[str, ...] = (
    "host",
    "username",
    "password",
    "verify_ssl",
    "ssl_ca_cert",
    "cert_file",
    "key_file",
    "api_key",
    "api_key_prefix",
    "safe_chars_for_path_param",
)


def _save_nifi_config() -> dict[str, Any]:
    """Snapshot the connection-relevant nipyapi config attributes."""
    cfg = nipyapi_config.nifi_config
    saved: dict[str, Any] = {}
    for attr in _SAVE_ATTRS:
        val = getattr(cfg, attr, None)
        # Shallow-copy dicts so the snapshot is independent of the live object.
        saved[attr] = dict(val) if isinstance(val, dict) else val
    return saved


def _restore_nifi_config(saved: dict[str, Any]) -> None:
    """Restore nipyapi config from a previously saved snapshot."""
    cfg = nipyapi_config.nifi_config
    for attr, val in saved.items():
        setattr(cfg, attr, val)
    # Nullifying api_client forces nipyapi to rebuild the HTTP client using the
    # restored host and authentication settings, preventing stale connection reuse.
    cfg.api_client = None


@contextmanager
def nifi_connection_scope(
    instance, *, normalize_url: bool = False
) -> Generator[None, None, None]:
    """Synchronous context manager that scopes nipyapi config to one NiFi instance.

    Usage (sync code / Celery tasks)::

        with nifi_connection_scope(instance):
            nipyapi.canvas.get_root_pg_id()

        with nifi_connection_scope(instance, normalize_url=True):
            nipyapi.canvas.get_root_pg_id()

    The original nipyapi config is restored on exit even if an exception occurs.
    """
    saved = _save_nifi_config()
    try:
        from services.nifi.connection import nifi_connection_service

        nifi_connection_service.configure_from_instance(
            instance, normalize_url=normalize_url
        )
        yield
    finally:
        _restore_nifi_config(saved)


@contextmanager
def nifi_test_connection_scope(**configure_kwargs) -> Generator[None, None, None]:
    """Synchronous context manager for ad-hoc test connection calls.

    Saves nipyapi config, calls ``NifiConnectionService.configure_test`` with
    ``configure_kwargs``, yields, then restores the original config.

    Usage::

        with nifi_test_connection_scope(nifi_url=url, username=u, password=p):
            result = test_connection()
    """
    saved = _save_nifi_config()
    try:
        from services.nifi.connection import nifi_connection_service

        nifi_connection_service.configure_test(**configure_kwargs)
        yield
    finally:
        _restore_nifi_config(saved)


async def with_nifi_instance(
    instance, sync_operation: Callable[[], Any], *, normalize_url: bool = False
) -> Any:
    """Run a synchronous nipyapi operation scoped to a specific NiFi instance.

    Intended for FastAPI async route handlers. Acquires the per-process asyncio
    lock to serialize nipyapi global-state mutations, then executes the
    synchronous operation in the default thread-pool executor.

    Args:
        instance:       NifiInstance ORM object with connection details.
        sync_operation: A zero-argument callable that performs one or more
                        nipyapi API calls.
        normalize_url:  Passed through to configure_from_instance.

    Returns:
        The return value of ``sync_operation()``.

    Example::

        result = await with_nifi_instance(
            instance,
            lambda: nipyapi.canvas.get_root_pg_id(),
        )
    """
    async with _nifi_lock:
        loop = asyncio.get_event_loop()

        def _run() -> Any:
            with nifi_connection_scope(instance, normalize_url=normalize_url):
                return sync_operation()

        return await loop.run_in_executor(None, _run)
