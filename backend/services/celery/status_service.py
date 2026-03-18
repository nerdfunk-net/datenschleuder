"""Celery Status Service.

Aggregates overall Celery system status from workers and Redis.
"""

from __future__ import annotations

import logging

import redis

from config import settings

logger = logging.getLogger(__name__)

_BEAT_LOCK_KEY = "datenschleuder:beat::lock"
_BEAT_SCHEDULE_KEY = "datenschleuder:beat::schedule"


class CeleryStatusService:
    """Service for querying Celery system status."""

    def get_system_status(self, celery_app) -> dict:
        """Return overall Celery system status.

        Uses a single Redis connection instead of creating two separate clients.

        Returns:
            Dict with keys: redis_connected, worker_count, active_tasks, beat_running.
        """
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        active = inspect.active()

        worker_count = len(stats) if stats else 0
        task_count = sum(len(tasks) for tasks in active.values()) if active else 0

        redis_connected, beat_running = self._check_redis_status()

        return {
            "redis_connected": redis_connected,
            "worker_count": worker_count,
            "active_tasks": task_count,
            "beat_running": beat_running,
        }

    def check_beat_running(self) -> dict:
        """Check whether Celery Beat is running.

        Returns:
            Dict with keys: beat_running, message.
        """
        _, beat_running = self._check_redis_status(ping=False)
        return {
            "beat_running": beat_running,
            "message": "Beat is running" if beat_running else "Beat not detected",
        }

    def _check_redis_status(self, ping: bool = True) -> tuple[bool, bool]:
        """Return (redis_connected, beat_running) using a single connection."""
        try:
            r = redis.from_url(settings.redis_url)
            if ping:
                r.ping()
            redis_connected = True
            beat_running = bool(r.exists(_BEAT_LOCK_KEY) or r.exists(_BEAT_SCHEDULE_KEY))
            return redis_connected, beat_running
        except Exception:
            return False, False

    def get_task_status(self, celery_app, task_id: str) -> dict:
        """Return status, result, progress, or error for a single Celery task.

        Possible states: PENDING, STARTED, PROGRESS, SUCCESS, FAILURE, RETRY, REVOKED.

        Args:
            celery_app: The Celery application instance.
            task_id: UUID of the task to inspect.

        Returns:
            Dict with keys: task_id, status, and conditionally result/error/progress.
        """
        from celery.result import AsyncResult

        result = AsyncResult(task_id, app=celery_app)
        response: dict = {"task_id": task_id, "status": result.state}

        if result.state == "PENDING":
            response["progress"] = {"status": "Task is queued and waiting to start"}
        elif result.state == "PROGRESS":
            response["progress"] = result.info
        elif result.state == "SUCCESS":
            response["result"] = result.result
        elif result.state == "FAILURE":
            response["error"] = str(result.info)

        return response

    def cancel_task(self, celery_app, task_id: str) -> dict:
        """Revoke and terminate a running or queued task.

        Args:
            celery_app: The Celery application instance.
            task_id: UUID of the task to cancel.

        Returns:
            Dict with keys: success, message.
        """
        from celery.result import AsyncResult

        AsyncResult(task_id, app=celery_app).revoke(terminate=True)
        return {"success": True, "message": f"Task {task_id} cancelled"}

    def list_workers(self, celery_app) -> dict:
        """Inspect all connected workers and return their status information.

        Args:
            celery_app: The Celery application instance.

        Returns:
            Dict with keys: success, workers (active_tasks, stats, registered_tasks,
            active_queues).
        """
        inspect = celery_app.control.inspect()
        return {
            "success": True,
            "workers": {
                "active_tasks": inspect.active() or {},
                "stats": inspect.stats() or {},
                "registered_tasks": inspect.registered() or {},
                "active_queues": inspect.active_queues() or {},
            },
        }
