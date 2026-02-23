"""
Celery task management API endpoints.
All Celery-related endpoints are under /api/celery/*
"""

from fastapi import APIRouter, Depends, HTTPException, status
from celery.result import AsyncResult
from kombu import Queue
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from celery_app import celery_app
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import redis
import os

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery"])


# Request/Response Models
class TestTaskRequest(BaseModel):
    message: str = "Hello from Celery!"


class ProgressTaskRequest(BaseModel):
    duration: int = 10


class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskWithJobResponse(BaseModel):
    """Response model for tasks that are tracked in the job database."""

    task_id: str
    job_id: Optional[str] = None
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
    progress: Optional[dict] = None


@router.post("/test", response_model=TaskResponse)
@handle_celery_errors("submit test task")
async def submit_test_task(
    request: TestTaskRequest,
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Submit a test task to verify Celery is working."""
    from tasks import test_tasks

    task = test_tasks.test_task.delay(message=request.message)

    return TaskResponse(
        task_id=task.id, status="queued", message=f"Test task submitted: {task.id}"
    )


@router.post("/test/progress", response_model=TaskResponse)
@handle_celery_errors("submit progress test task")
async def submit_progress_test_task(
    request: ProgressTaskRequest,
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Submit a test task that reports progress."""
    from tasks import test_tasks

    task = test_tasks.test_progress_task.delay(duration=request.duration)

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Progress test task submitted: {task.id}",
    )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
@handle_celery_errors("get task status")
async def get_task_status(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get the status and result of a Celery task.

    Status can be: PENDING, STARTED, PROGRESS, SUCCESS, FAILURE, RETRY, REVOKED
    """
    result = AsyncResult(task_id, app=celery_app)

    response = TaskStatusResponse(task_id=task_id, status=result.state)

    if result.state == "PENDING":
        response.progress = {"status": "Task is queued and waiting to start"}

    elif result.state == "PROGRESS":
        response.progress = result.info

    elif result.state == "SUCCESS":
        response.result = result.result

    elif result.state == "FAILURE":
        response.error = str(result.info)

    return response


@router.delete("/tasks/{task_id}")
@handle_celery_errors("cancel task")
async def cancel_task(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Cancel a running or queued task."""
    result = AsyncResult(task_id, app=celery_app)
    result.revoke(terminate=True)

    return {"success": True, "message": f"Task {task_id} cancelled"}


@router.get("/workers")
@handle_celery_errors("list workers")
async def list_workers(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """List active Celery workers and their status, including queue assignments."""
    inspect = celery_app.control.inspect()
    active = inspect.active()
    stats = inspect.stats()
    registered = inspect.registered()
    active_queues = inspect.active_queues()

    return {
        "success": True,
        "workers": {
            "active_tasks": active or {},
            "stats": stats or {},
            "registered_tasks": registered or {},
            "active_queues": active_queues or {},
        },
    }


@router.get("/queues")
@handle_celery_errors("list queues")
async def list_queues(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    List all Celery queues with their metrics and worker assignments.

    Returns information about:
    - Queue names and configuration
    - Pending tasks in each queue
    - Active tasks per queue
    - Which workers are consuming from each queue
    - Task routing configuration
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

            active_count = 0
            workers_consuming = []

            if active_queues:
                for worker_name, worker_queues in active_queues.items():
                    for queue_info in worker_queues:
                        if queue_info.get("name") == queue_name:
                            workers_consuming.append(worker_name)

            if active_tasks:
                for worker_name, tasks in active_tasks.items():
                    if worker_name in workers_consuming:
                        active_count += len(tasks)

            routed_tasks = []
            for task_pattern, route_config in task_routes.items():
                if route_config.get("queue") == queue_name:
                    routed_tasks.append(task_pattern)

            queues.append(
                {
                    "name": queue_name,
                    "pending_tasks": pending_count,
                    "active_tasks": active_count,
                    "workers_consuming": workers_consuming,
                    "worker_count": len(workers_consuming),
                    "routed_tasks": routed_tasks,
                    "exchange": task_queues[queue_name].get("exchange"),
                    "routing_key": task_queues[queue_name].get("routing_key"),
                }
            )

        redis_client.close()

        return {
            "success": True,
            "queues": queues,
            "total_queues": len(queues),
        }

    except Exception as e:
        logger.error("Error fetching queue metrics: %s", e)
        return {
            "success": False,
            "error": str(e),
            "queues": [],
            "total_queues": 0,
        }


@router.delete("/queues/{queue_name}/purge")
@handle_celery_errors("purge queue")
async def purge_queue(
    queue_name: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Purge all pending tasks from a specific queue.

    Args:
        queue_name: Name of the queue to purge (e.g., 'default', 'backup', 'network', 'heavy')
    """
    try:
        task_queues = celery_app.conf.task_queues or {}
        if queue_name not in task_queues.keys():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Queue '{queue_name}' not found",
            )

        with celery_app.connection_or_acquire() as conn:
            queue_config = task_queues[queue_name]
            queue_obj = Queue(
                name=queue_name,
                exchange=queue_config.get("exchange", queue_name),
                routing_key=queue_config.get("routing_key", queue_name),
            )
            purged_count = queue_obj(conn.channel()).purge()

        logger.info(
            "Purged %s task(s) from queue '%s' by user %s",
            purged_count,
            queue_name,
            current_user.get("username"),
        )

        return {
            "success": True,
            "queue": queue_name,
            "purged_tasks": purged_count or 0,
            "message": f"Purged {purged_count or 0} pending task(s) from queue '{queue_name}'",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error purging queue %s: %s", queue_name, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purge queue: {str(e)}",
        )


@router.delete("/queues/purge-all")
@handle_celery_errors("purge all queues")
async def purge_all_queues(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Purge all pending tasks from all queues."""
    try:
        task_queues = celery_app.conf.task_queues or {}

        purged_queues = []
        total_purged = 0

        with celery_app.connection_or_acquire() as conn:
            for queue_name in task_queues.keys():
                try:
                    queue_config = task_queues[queue_name]
                    queue_obj = Queue(
                        name=queue_name,
                        exchange=queue_config.get("exchange", queue_name),
                        routing_key=queue_config.get("routing_key", queue_name),
                    )
                    purged_count = queue_obj(conn.channel()).purge()

                    purged_queues.append(
                        {"queue": queue_name, "purged_tasks": purged_count or 0}
                    )
                    total_purged += purged_count or 0

                    logger.info(
                        "Purged %s task(s) from queue '%s'", purged_count, queue_name
                    )
                except Exception as e:
                    logger.error("Error purging queue %s: %s", queue_name, e)
                    purged_queues.append(
                        {"queue": queue_name, "purged_tasks": 0, "error": str(e)}
                    )

        logger.info(
            "Purged total of %s task(s) from all queues by user %s",
            total_purged,
            current_user.get("username"),
        )

        return {
            "success": True,
            "total_purged": total_purged,
            "queues": purged_queues,
            "message": f"Purged {total_purged} pending task(s) from {len(purged_queues)} queue(s)",
        }

    except Exception as e:
        logger.error("Error purging all queues: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purge all queues: {str(e)}",
        )


@router.get("/schedules")
@handle_celery_errors("list schedules")
async def list_schedules(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """List all periodic task schedules configured in Celery Beat."""
    beat_schedule = celery_app.conf.beat_schedule or {}

    schedules = []
    for name, config in beat_schedule.items():
        schedules.append(
            {
                "name": name,
                "task": config.get("task"),
                "schedule": str(config.get("schedule")),
                "options": config.get("options", {}),
            }
        )

    return {"success": True, "schedules": schedules}


@router.get("/beat/status")
@handle_celery_errors("get beat status")
async def beat_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get Celery Beat scheduler status."""
    r = redis.from_url(settings.redis_url)

    beat_lock_key = "datenschleuder:beat::lock"
    lock_exists = r.exists(beat_lock_key)

    beat_schedule_key = "datenschleuder:beat::schedule"
    schedule_exists = r.exists(beat_schedule_key)

    beat_running = bool(lock_exists or schedule_exists)

    return {
        "success": True,
        "beat_running": beat_running,
        "message": "Beat is running" if beat_running else "Beat not detected",
    }


@router.get("/status")
@handle_celery_errors("get celery status")
async def celery_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get overall Celery system status."""
    inspect = celery_app.control.inspect()
    stats = inspect.stats()
    active = inspect.active()

    worker_count = len(stats) if stats else 0

    task_count = 0
    if active:
        for worker_tasks in active.values():
            task_count += len(worker_tasks)

    try:
        r = redis.from_url(settings.redis_url)
        r.ping()
        redis_connected = True
    except Exception:
        redis_connected = False

    try:
        r = redis.from_url(settings.redis_url)
        beat_lock_key = "datenschleuder:beat::lock"
        beat_running = bool(r.exists(beat_lock_key))
    except Exception:
        beat_running = False

    return {
        "success": True,
        "status": {
            "redis_connected": redis_connected,
            "worker_count": worker_count,
            "active_tasks": task_count,
            "beat_running": beat_running,
        },
    }


@router.get("/config")
@handle_celery_errors("get celery config")
async def get_celery_config(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get current Celery configuration (read-only).
    Configuration is set via environment variables and cannot be changed at runtime.
    """
    redis_host = os.getenv("DATENSCHLEUDER_REDIS_HOST", "localhost")
    redis_port = os.getenv("DATENSCHLEUDER_REDIS_PORT", "6379")
    redis_password = os.getenv("DATENSCHLEUDER_REDIS_PASSWORD", "")
    has_password = bool(redis_password)

    conf = celery_app.conf

    return {
        "success": True,
        "config": {
            "redis": {
                "host": redis_host,
                "port": redis_port,
                "has_password": has_password,
                "database": "0",
            },
            "worker": {
                "max_concurrency": settings.celery_max_workers,
                "prefetch_multiplier": conf.worker_prefetch_multiplier,
                "max_tasks_per_child": conf.worker_max_tasks_per_child,
            },
            "task": {
                "time_limit": conf.task_time_limit,
                "serializer": conf.task_serializer,
                "track_started": conf.task_track_started,
            },
            "result": {
                "expires": conf.result_expires,
                "serializer": conf.result_serializer,
            },
            "beat": {
                "scheduler": conf.beat_scheduler,
                "schedule_count": len(conf.beat_schedule) if conf.beat_schedule else 0,
            },
            "timezone": conf.timezone,
            "enable_utc": conf.enable_utc,
        },
    }


@router.post("/tasks/cache-demo", response_model=TaskResponse)
@handle_celery_errors("trigger cache demo task")
async def trigger_cache_demo(
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """
    Trigger a simple cache demo task.
    This is a placeholder showing where your caching logic would go.
    """
    from services.background_jobs import cache_demo_task

    task = cache_demo_task.delay()

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Cache demo task queued: {task.id}",
    )


# ============================================================================
# Celery Settings Endpoints
# ============================================================================


class CeleryQueue(BaseModel):
    """
    Celery queue configuration.

    Fields:
        name: Queue name (e.g., "default", "backup", "network", "heavy")
        description: Human-readable description of queue purpose
        built_in: True for hardcoded queues (cannot be deleted), False for custom queues
    """

    name: str
    description: str = ""
    built_in: bool = False


class CelerySettingsRequest(BaseModel):
    max_workers: Optional[int] = None
    cleanup_enabled: Optional[bool] = None
    cleanup_interval_hours: Optional[int] = None
    cleanup_age_hours: Optional[int] = None
    result_expires_hours: Optional[int] = None
    queues: Optional[List[CeleryQueue]] = None


@router.get("/settings")
@handle_celery_errors("get celery settings")
async def get_celery_settings(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get current Celery settings from database."""
    from settings_manager import settings_manager

    celery_settings = settings_manager.get_celery_settings()

    return {"success": True, "settings": celery_settings}


@router.put("/settings")
@handle_celery_errors("update celery settings")
async def update_celery_settings(
    request: CelerySettingsRequest,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Update Celery settings."""
    from settings_manager import settings_manager

    current = settings_manager.get_celery_settings()
    updates = request.model_dump(exclude_unset=True)

    if "queues" in updates:
        built_in_queue_names = {"default", "backup", "network", "heavy"}
        updated_queue_names = {q["name"] for q in updates["queues"]}

        missing_built_ins = built_in_queue_names - updated_queue_names
        if missing_built_ins:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot remove built-in queues: {', '.join(missing_built_ins)}. "
                f"Built-in queues (default, backup, network, heavy) are required.",
            )

        for queue in updates["queues"]:
            if queue["name"] in built_in_queue_names:
                queue["built_in"] = True
            elif "built_in" not in queue:
                queue["built_in"] = False

    merged = {**current, **updates}

    success = settings_manager.update_celery_settings(merged)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update Celery settings",
        )

    updated = settings_manager.get_celery_settings()

    return {
        "success": True,
        "settings": updated,
        "message": "Celery settings updated. Worker restart required for max_workers changes.",
    }


@router.post("/cleanup", response_model=TaskResponse)
@handle_celery_errors("trigger cleanup task")
async def trigger_cleanup(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Manually trigger the Celery cleanup task."""
    from tasks.periodic_tasks import cleanup_celery_data_task

    task = cleanup_celery_data_task.delay()

    return TaskResponse(
        task_id=task.id, status="queued", message=f"Cleanup task triggered: {task.id}"
    )


@router.get("/cleanup/stats")
@handle_celery_errors("get cleanup stats")
async def get_cleanup_stats(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get statistics about data that would be cleaned up."""
    from settings_manager import settings_manager
    from datetime import datetime, timezone, timedelta

    celery_settings = settings_manager.get_celery_settings()
    cleanup_age_hours = celery_settings.get("cleanup_age_hours", 24)
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=cleanup_age_hours)

    r = redis.from_url(settings.redis_url)
    result_keys = list(r.scan_iter("celery-task-meta-*"))

    return {
        "success": True,
        "stats": {
            "cleanup_age_hours": cleanup_age_hours,
            "cutoff_time": cutoff_time.isoformat(),
            "total_result_keys": len(result_keys),
            "message": f"Cleanup will remove task results older than {cleanup_age_hours} hours",
        },
    }
