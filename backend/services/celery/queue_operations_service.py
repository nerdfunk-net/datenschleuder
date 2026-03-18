"""Celery Queue Operations Service.

Handles queue purge operations using Kombu.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from kombu import Queue

logger = logging.getLogger(__name__)


class CeleryQueueOperationsService:
    """Service for purge operations on Celery queues."""

    def purge_queue(self, celery_app, queue_name: str) -> int:
        """Purge all pending tasks from a specific queue.

        Args:
            celery_app: The Celery application instance.
            queue_name: Name of the queue to purge.

        Returns:
            Number of tasks purged.

        Raises:
            HTTPException 404 if queue not found.
        """
        task_queues = celery_app.conf.task_queues or {}
        if queue_name not in task_queues:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Queue '{queue_name}' not found",
            )

        with celery_app.connection_or_acquire() as conn:
            queue_obj = self._construct_queue(queue_name, task_queues[queue_name])
            purged_count = queue_obj(conn.channel()).purge()

        logger.info("Purged %s task(s) from queue '%s'", purged_count, queue_name)
        return purged_count or 0

    def purge_all_queues(self, celery_app) -> dict:
        """Purge all pending tasks from every configured queue.

        Returns:
            Dict with keys: total_purged, queues (list of per-queue results).
        """
        task_queues = celery_app.conf.task_queues or {}
        purged_queues = []
        total_purged = 0

        with celery_app.connection_or_acquire() as conn:
            for queue_name in task_queues.keys():
                try:
                    queue_obj = self._construct_queue(queue_name, task_queues[queue_name])
                    purged_count = queue_obj(conn.channel()).purge() or 0
                    purged_queues.append({"queue": queue_name, "purged_tasks": purged_count})
                    total_purged += purged_count
                    logger.info("Purged %s task(s) from queue '%s'", purged_count, queue_name)
                except Exception as e:
                    logger.error("Error purging queue %s: %s", queue_name, e)
                    purged_queues.append({"queue": queue_name, "purged_tasks": 0, "error": str(e)})

        return {"total_purged": total_purged, "queues": purged_queues}

    def _construct_queue(self, queue_name: str, queue_config: dict) -> Queue:
        """Build a Kombu Queue object from configuration."""
        return Queue(
            name=queue_name,
            exchange=queue_config.get("exchange", queue_name),
            routing_key=queue_config.get("routing_key", queue_name),
        )
