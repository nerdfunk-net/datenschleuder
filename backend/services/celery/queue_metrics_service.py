"""Celery Queue Metrics Service.

Aggregates queue depth and worker assignment metrics from Redis and Celery inspect.
"""

from __future__ import annotations

import logging

import redis

from config import settings

logger = logging.getLogger(__name__)


class CeleryQueueMetricsService:
    """Service for reading Celery queue metrics."""

    def list_queue_metrics(self, celery_app) -> dict:
        """Return metrics for all configured queues.

        Args:
            celery_app: The Celery application instance.

        Returns:
            Dict with keys: success, queues, total_queues.
        """
        inspect = celery_app.control.inspect()
        active_queues = inspect.active_queues()
        active_tasks = inspect.active()

        task_queues = celery_app.conf.task_queues or {}
        task_routes = celery_app.conf.task_routes or {}

        try:
            redis_client = redis.Redis.from_url(settings.redis_url)
            queues = []

            for queue_name in task_queues.keys():
                pending_count = redis_client.llen(queue_name)
                workers_consuming = self._get_workers_consuming(queue_name, active_queues)
                active_count = self._get_active_count(workers_consuming, active_tasks)
                routed_tasks = self._get_routed_tasks(queue_name, task_routes)

                queues.append({
                    "name": queue_name,
                    "pending_tasks": pending_count,
                    "active_tasks": active_count,
                    "workers_consuming": workers_consuming,
                    "worker_count": len(workers_consuming),
                    "routed_tasks": routed_tasks,
                    "exchange": task_queues[queue_name].get("exchange"),
                    "routing_key": task_queues[queue_name].get("routing_key"),
                })

            redis_client.close()
            return {"success": True, "queues": queues, "total_queues": len(queues)}

        except Exception as e:
            logger.error("Error fetching queue metrics: %s", e)
            return {"success": False, "error": str(e), "queues": [], "total_queues": 0}

    def _get_workers_consuming(self, queue_name: str, active_queues: dict) -> list:
        """Return list of worker names consuming from queue_name."""
        workers = []
        if active_queues:
            for worker_name, worker_queues in active_queues.items():
                for queue_info in worker_queues:
                    if queue_info.get("name") == queue_name:
                        workers.append(worker_name)
        return workers

    def _get_active_count(self, workers_consuming: list, active_tasks: dict) -> int:
        """Count active tasks across workers that consume from a queue."""
        if not active_tasks:
            return 0
        return sum(
            len(tasks)
            for worker_name, tasks in active_tasks.items()
            if worker_name in workers_consuming
        )

    def _get_routed_tasks(self, queue_name: str, task_routes: dict) -> list:
        """Return list of task patterns routed to queue_name."""
        return [
            task_pattern
            for task_pattern, route_config in task_routes.items()
            if route_config.get("queue") == queue_name
        ]
