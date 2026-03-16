"""
Periodic tasks executed by Celery Beat.
These tasks run on a schedule defined in beat_schedule.py
"""

from celery import shared_task
from celery_app import celery_app
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@shared_task(name="tasks.worker_health_check")
def worker_health_check() -> dict:
    """
    Periodic task: Health check for Celery workers.

    Runs every 5 minutes (configured in beat_schedule.py)
    Monitors worker health and logs status.

    Returns:
        dict: Health check results
    """
    try:
        inspect = celery_app.control.inspect()

        # Get active workers
        inspect.active()
        stats = inspect.stats()

        active_workers = len(stats) if stats else 0

        logger.info("Health check: %s workers active", active_workers)

        return {
            "success": True,
            "active_workers": active_workers,
            "message": f"{active_workers} workers active",
        }

    except Exception as e:
        logger.error("Health check failed: %s", e)
        return {"success": False, "error": str(e)}


@shared_task(name="tasks.cleanup_celery_data")
def cleanup_celery_data_task() -> dict:
    """
    Cleanup old Celery task results and job run data.

    This task:
    1. Reads cleanup_age_hours from Celery settings
    2. Removes task results from Redis older than the configured age
    3. Removes old job run records from database

    Returns:
        dict: Cleanup results with counts of removed items
    """
    try:
        import service_factory
        from datetime import datetime, timezone, timedelta
        from config import settings
        import redis
        import json

        # Get cleanup settings
        celery_settings = service_factory.build_settings_manager().get_celery_settings()
        cleanup_age_hours = celery_settings.get("cleanup_age_hours", 24)

        if not celery_settings.get("cleanup_enabled", True):
            return {
                "success": True,
                "message": "Cleanup is disabled",
                "removed_results": 0,
                "removed_job_runs": 0,
            }

        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=cleanup_age_hours)

        logger.info(
            "Starting Celery cleanup: removing data older than %s hours",
            cleanup_age_hours,
        )

        # Connect to Redis
        r = redis.from_url(settings.redis_url)

        # Count and remove old task results
        removed_results = 0
        result_keys = list(r.scan_iter("celery-task-meta-*"))

        for key in result_keys:
            try:
                # Get the result data
                data = r.get(key)
                if data:
                    result_data = json.loads(data)
                    # Check if task has a date_done field
                    date_done = result_data.get("date_done")
                    if date_done:
                        # Parse the date (Celery stores it as ISO format)
                        if isinstance(date_done, str):
                            task_time = datetime.fromisoformat(
                                date_done.replace("Z", "+00:00")
                            )
                            if task_time < cutoff_time:
                                r.delete(key)
                                removed_results += 1
            except Exception as e:
                logger.debug("Error processing key %s: %s", key, e)
                continue

        # Remove old job runs from database
        removed_job_runs = 0
        try:
            import job_run_manager

            # Use the hours-based cleanup function
            removed_job_runs = job_run_manager.cleanup_old_runs_hours(cleanup_age_hours)
        except Exception as e:
            logger.warning("Error cleaning up job runs: %s", e)

        logger.info(
            "Cleanup completed: %s results, %s job runs removed",
            removed_results,
            removed_job_runs,
        )

        return {
            "success": True,
            "message": "Cleanup completed",
            "cleanup_age_hours": cleanup_age_hours,
            "cutoff_time": cutoff_time.isoformat(),
            "removed_results": removed_results,
            "removed_job_runs": removed_job_runs,
        }

    except Exception as e:
        logger.error("Cleanup task failed: %s", e)
        return {"success": False, "error": str(e)}


@shared_task(name="tasks.check_stale_jobs")
def check_stale_jobs_task() -> dict:
    """
    Periodic task: Detect and mark stale/crashed jobs as failed.

    A job is considered stale if:
    - Status is 'running' or 'pending'
    - Started more than 2 hours ago (or pending more than 1 hour)
    - Celery task ID doesn't exist in active/reserved tasks

    Runs every 10 minutes.
    """
    try:
        import job_run_manager
        from celery_app import celery_app

        # Get all running/pending jobs
        running_jobs = job_run_manager.get_recent_runs(limit=500, status="running")
        pending_jobs = job_run_manager.get_recent_runs(limit=500, status="pending")

        # Get active Celery tasks
        inspect = celery_app.control.inspect()
        active_tasks = inspect.active() or {}
        reserved_tasks = inspect.reserved() or {}

        # Collect all active task IDs
        active_task_ids = set()
        for worker_tasks in active_tasks.values():
            active_task_ids.update(task["id"] for task in worker_tasks)
        for worker_tasks in reserved_tasks.values():
            active_task_ids.update(task["id"] for task in worker_tasks)

        now = datetime.now(timezone.utc)
        marked_failed = []

        # Check running jobs
        for job in running_jobs:
            started_at = job.get("started_at")
            celery_task_id = job.get("celery_task_id")

            if not started_at:
                continue

            # Parse datetime
            if isinstance(started_at, str):
                started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))

            # Job running for more than 2 hours
            running_duration = (now - started_at).total_seconds()
            if running_duration > 7200:  # 2 hours
                # Check if task still exists in Celery
                if celery_task_id not in active_task_ids:
                    job_run_manager.mark_failed(
                        job["id"],
                        "Job marked as failed - exceeded maximum runtime (2 hours) and not found in active tasks",
                    )
                    marked_failed.append(
                        {
                            "job_id": job["id"],
                            "job_name": job["job_name"],
                            "running_duration": int(running_duration),
                        }
                    )
                    logger.warning(
                        "Marked stale job %s (%s) as failed - running for %s minutes",
                        job["id"],
                        job["job_name"],
                        int(running_duration / 60),
                    )

        # Check pending jobs
        for job in pending_jobs:
            queued_at = job.get("queued_at")
            if not queued_at:
                continue

            # Parse datetime
            if isinstance(queued_at, str):
                queued_at = datetime.fromisoformat(queued_at.replace("Z", "+00:00"))

            # Job pending for more than 1 hour
            pending_duration = (now - queued_at).total_seconds()
            if pending_duration > 3600:  # 1 hour
                job_run_manager.mark_failed(
                    job["id"],
                    "Job marked as failed - stuck in pending state for over 1 hour",
                )
                marked_failed.append(
                    {
                        "job_id": job["id"],
                        "job_name": job["job_name"],
                        "pending_duration": int(pending_duration),
                    }
                )
                logger.warning(
                    "Marked pending job %s (%s) as failed - pending for %s minutes",
                    job["id"],
                    job["job_name"],
                    int(pending_duration / 60),
                )

        if marked_failed:
            logger.info(
                "Stale job check: marked %s job(s) as failed", len(marked_failed)
            )

        return {
            "success": True,
            "stale_jobs_found": len(marked_failed),
            "marked_failed": marked_failed,
        }

    except Exception as e:
        logger.error("Error checking stale jobs: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}
