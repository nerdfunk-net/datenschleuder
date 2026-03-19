"""
Celery task management API endpoints.
All Celery-related endpoints are under /api/celery/*
"""

from fastapi import APIRouter, Depends, HTTPException, status
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from celery_app import celery_app
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import os

from config import settings
from services.celery.queue_metrics_service import CeleryQueueMetricsService
from services.celery.queue_operations_service import CeleryQueueOperationsService
from services.celery.settings_service import CelerySettingsService
from services.celery.status_service import CeleryStatusService

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
def get_task_status(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get the status and result of a Celery task.

    Status can be: PENDING, STARTED, PROGRESS, SUCCESS, FAILURE, RETRY, REVOKED
    """
    return CeleryStatusService().get_task_status(celery_app, task_id)


@router.delete("/tasks/{task_id}")
@handle_celery_errors("cancel task")
def cancel_task(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Cancel a running or queued task."""
    return CeleryStatusService().cancel_task(celery_app, task_id)


@router.get("/workers")
@handle_celery_errors("list workers")
def list_workers(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """List active Celery workers and their status, including queue assignments."""
    return CeleryStatusService().list_workers(celery_app)


@router.get("/queues")
@handle_celery_errors("list queues")
def list_queues(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """List all Celery queues with their metrics and worker assignments."""
    return CeleryQueueMetricsService().list_queue_metrics(celery_app)


@router.delete("/queues/{queue_name}/purge")
@handle_celery_errors("purge queue")
def purge_queue(
    queue_name: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Purge all pending tasks from a specific queue."""
    try:
        purged_count = CeleryQueueOperationsService().purge_queue(celery_app, queue_name)
        logger.info(
            "Purged %s task(s) from queue '%s' by user %s",
            purged_count, queue_name, current_user.get("username"),
        )
        return {
            "success": True,
            "queue": queue_name,
            "purged_tasks": purged_count,
            "message": f"Purged {purged_count} pending task(s) from queue '{queue_name}'",
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
def purge_all_queues(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Purge all pending tasks from all queues."""
    try:
        result = CeleryQueueOperationsService().purge_all_queues(celery_app)
        logger.info(
            "Purged total of %s task(s) from all queues by user %s",
            result["total_purged"], current_user.get("username"),
        )
        return {
            "success": True,
            "total_purged": result["total_purged"],
            "queues": result["queues"],
            "message": f"Purged {result['total_purged']} pending task(s) from {len(result['queues'])} queue(s)",
        }
    except Exception as e:
        logger.error("Error purging all queues: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purge all queues: {str(e)}",
        )


@router.get("/schedules")
@handle_celery_errors("list schedules")
def list_schedules(
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
def beat_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get Celery Beat scheduler status."""
    result = CeleryStatusService().check_beat_running()
    return {"success": True, **result}


@router.get("/status")
@handle_celery_errors("get celery status")
def celery_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get overall Celery system status."""
    return {"success": True, "status": CeleryStatusService().get_system_status(celery_app)}


@router.get("/config")
@handle_celery_errors("get celery config")
def get_celery_config(
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


# ---------------------------------------------------------------------------
# NiFi queue check task
# ---------------------------------------------------------------------------


class CheckQueuesRequest(BaseModel):
    """Request body for the NiFi queue-check task endpoint.

    Fields:
        cluster_ids:         NiFi cluster IDs to check.  ``None`` or an empty list
                             means *all* configured clusters.
        check_queues_mode:   Metric to evaluate – ``'count'``, ``'bytes'``, or ``'both'``.
        count_yellow:        Flow-file count threshold for yellow status (default 1 000).
        count_red:           Flow-file count threshold for red status (default 10 000).
        bytes_yellow:        Queue size in MB for yellow status (default 10 MB).
        bytes_red:           Queue size in MB for red status (default 100 MB).
    """

    cluster_ids: Optional[List[int]] = None
    check_queues_mode: str = "count"
    count_yellow: int = 1_000
    count_red: int = 10_000
    bytes_yellow: int = 10
    bytes_red: int = 100


@router.post("/tasks/check-queues", response_model=TaskResponse)
@handle_celery_errors("trigger NiFi check-queues task")
async def trigger_check_queues(
    request: CheckQueuesRequest,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Trigger a NiFi queue-depth check as a tracked Celery background task.

    The task iterates over every specified NiFi instance (or all instances when
    ``instance_ids`` is omitted) and evaluates the queue depth of each connection
    against the supplied thresholds.

    Each connection receives a ``queue_check.status`` of ``"green"``, ``"yellow"``,
    or ``"red"``.  The worst individual status is promoted to the instance-level
    ``overall_status`` and then to the top-level ``overall_status`` in the result.

    Trigger rules (both thresholds inclusive on the upper bound):
    - ``queued_count >= red_threshold``    → red
    - ``queued_count >= yellow_threshold`` → yellow
    - otherwise                            → green

    The job result is stored in the job-runs table and can be inspected in the
    **Jobs → View** section of the UI.
    """
    from tasks import dispatch_job

    job_params: Dict[str, Any] = {
        "check_queues_mode": request.check_queues_mode,
        "check_queues_count_yellow": request.count_yellow,
        "check_queues_count_red": request.count_red,
        "check_queues_bytes_yellow": request.bytes_yellow,
        "check_queues_bytes_red": request.bytes_red,
    }
    if request.cluster_ids:
        job_params["nifi_cluster_ids"] = request.cluster_ids

    task = dispatch_job.delay(
        job_name="check-queues",
        job_type="check_queues",
        job_parameters=job_params,
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )

    logger.info(
        "check-queues task %s submitted by %s (clusters=%s, mode=%s)",
        task.id,
        current_user.get("username"),
        request.cluster_ids or "all",
        request.check_queues_mode,
    )

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message="NiFi queue-check task queued: %s" % task.id,
    )


# ---------------------------------------------------------------------------
# NiFi check-process-group task
# ---------------------------------------------------------------------------


class CheckProcessGroupRequest(BaseModel):
    """Request body for the NiFi check-process-group task endpoint.

    Fields:
        nifi_cluster_id:    ID of the NiFi cluster to connect to (primary instance is resolved).
        process_group_id:   UUID of the process group to inspect.
        process_group_path: Human-readable path (used in logs/results only).
        check_children:     When ``True``, each direct child process group is
                            also evaluated individually. Defaults to ``True``.
        expected_status:    One of ``"Running"``, ``"Stopped"``, ``"Disabled"``,
                            ``"Enabled"``.  Evaluation logic:

                            - ``"Running"``  → stale_count, stopped_count, disabled_count must all be 0.
                            - ``"Stopped"``  → running_count, stale_count, disabled_count must all be 0.
                            - ``"Disabled"`` → running_count, stale_count, stopped_count must all be 0.
                            - ``"Enabled"``  → disabled_count must be 0.
    """

    nifi_cluster_id: int
    process_group_id: str
    process_group_path: Optional[str] = None
    check_children: bool = True
    expected_status: str = "Running"


@router.post("/tasks/check-process-group", response_model=TaskResponse)
@handle_celery_errors("trigger NiFi check-process-group task")
async def trigger_check_process_group(
    request: CheckProcessGroupRequest,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Trigger a NiFi process-group status check as a tracked Celery background task.

    The task connects to the specified NiFi instance, fetches the
    ``ProcessGroupEntity`` via the canvas API, and evaluates the component
    counters (``running_count``, ``stopped_count``, ``disabled_count``,
    ``stale_count``) against the configured *expected_status*.

    Valid values for **expected_status**:

    - ``"Running"``  → stale_count, stopped_count, and disabled_count must all be 0.
    - ``"Stopped"``  → running_count, stale_count, and disabled_count must all be 0.
    - ``"Disabled"`` → running_count, stale_count, and stopped_count must all be 0.
    - ``"Enabled"``  → disabled_count must be 0.

    When **check_children** is ``true``, each direct child process group is
    evaluated individually using the same expected status.  The overall result
    fails if any child does not match.
    """
    from tasks import dispatch_job

    valid_statuses = {"Running", "Stopped", "Disabled", "Enabled"}
    if request.expected_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expected_status must be one of: %s"
            % ", ".join(sorted(valid_statuses)),
        )

    job_params: Dict[str, Any] = {
        "nifi_cluster_id": request.nifi_cluster_id,
        "process_group_id": request.process_group_id,
        "process_group_path": request.process_group_path,
        "check_children": request.check_children,
        "expected_status": request.expected_status,
    }

    task = dispatch_job.delay(
        job_name="check-process-group",
        job_type="check_progress_group",
        job_parameters=job_params,
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )

    logger.info(
        "check-process-group task %s submitted by %s (cluster=%d, pg=%s, expected=%s)",
        task.id,
        current_user.get("username"),
        request.nifi_cluster_id,
        request.process_group_id,
        request.expected_status,
    )

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message="NiFi check-process-group task queued: %s" % task.id,
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
def get_celery_settings(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get current Celery settings from database."""
    return {"success": True, "settings": CelerySettingsService().get_settings()}


@router.put("/settings")
@handle_celery_errors("update celery settings")
def update_celery_settings(
    request: CelerySettingsRequest,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Update Celery settings."""
    try:
        updates = request.model_dump(exclude_unset=True)
        updated = CelerySettingsService().update_settings(updates)
        return {
            "success": True,
            "settings": updated,
            "message": "Celery settings updated. Worker restart required for max_workers changes.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating celery settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Celery settings: {str(e)}",
        )


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
def get_cleanup_stats(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get statistics about data that would be cleaned up."""
    from services.settings.settings_service import SettingsService
    settings_manager = SettingsService()
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
