"""
Job Runs Router
API endpoints for viewing and managing job run history.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import require_permission
import job_run_manager
from models.jobs import JobRunResponse, JobRunListResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/job-runs", tags=["job-runs"])


@router.get("", response_model=JobRunListResponse)
async def list_job_runs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(
        None, description="Filter by status (comma-separated for multiple)"
    ),
    job_type: Optional[str] = Query(
        None, description="Filter by job type (comma-separated for multiple)"
    ),
    triggered_by: Optional[str] = Query(
        None, description="Filter by trigger type (comma-separated for multiple)"
    ),
    schedule_id: Optional[int] = Query(None, description="Filter by schedule ID"),
    template_id: Optional[str] = Query(
        None, description="Filter by template ID (comma-separated for multiple)"
    ),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """
    List job runs with pagination and optional filters.

    Filters support comma-separated values for multiple selections.
    Example: ?status=completed,failed&job_type=backup,sync_devices

    Returns paginated list of job runs including:
    - Job run details (name, type, status)
    - Timing information (queued, started, completed, duration)
    - Error messages for failed jobs
    - Related schedule and template information
    """
    try:
        # Parse comma-separated values into lists
        status_list = status.split(",") if status else None
        job_type_list = job_type.split(",") if job_type else None
        triggered_by_list = triggered_by.split(",") if triggered_by else None
        template_id_list = (
            [int(t) for t in template_id.split(",") if t.isdigit()]
            if template_id
            else None
        )

        result = job_run_manager.list_job_runs(
            page=page,
            page_size=page_size,
            status=status_list,
            job_type=job_type_list,
            triggered_by=triggered_by_list,
            schedule_id=schedule_id,
            template_id=template_id_list,
        )
        return result
    except Exception as e:
        logger.error("Error listing job runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def get_distinct_templates(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """
    Get distinct templates used in job runs (for filter dropdown).
    """
    try:
        templates = job_run_manager.get_distinct_templates()
        return {"templates": templates}
    except Exception as e:
        logger.error("Error getting templates: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
async def get_recent_runs(
    limit: int = Query(50, ge=1, le=200, description="Number of runs to return"),
    status: Optional[str] = Query(None, description="Filter by status"),
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """
    Get recent job runs (simplified endpoint for dashboard).
    """
    try:
        runs = job_run_manager.get_recent_runs(
            limit=limit, status=status, job_type=job_type
        )
        return runs
    except Exception as e:
        logger.error("Error getting recent runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_job_stats(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """
    Get job queue statistics.

    Returns counts of running and pending jobs.
    """
    try:
        stats = job_run_manager.get_queue_stats()
        return stats
    except Exception as e:
        logger.error("Error getting job stats: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """
    Get dashboard statistics for job runs.

    Returns:
    - Job run statistics (total, success, failed, running)
    - Backup device statistics (total devices backed up, success, failed)
    """
    try:
        stats = job_run_manager.get_dashboard_stats()
        return stats
    except Exception as e:
        logger.error("Error getting dashboard stats: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{run_id}", response_model=JobRunResponse)
async def get_job_run(
    run_id: int, current_user: dict = Depends(require_permission("jobs.runs", "read"))
):
    """
    Get a specific job run by ID.
    """
    try:
        run = job_run_manager.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")
        return run
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting job run %s: %s", run_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{run_id}/progress")
async def get_job_progress(
    run_id: int, current_user: dict = Depends(require_permission("jobs.runs", "read"))
):
    """
    Get progress information for a running backup job.

    Returns progress counter from Redis for parallel backup jobs.
    """
    try:
        from celery_app import celery_app

        # Get job run to check status
        run = job_run_manager.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")

        # Only provide progress for running jobs
        if run["status"] != "running":
            return {
                "status": run["status"],
                "completed": None,
                "total": None,
                "percentage": None,
            }

        # Get progress from Redis
        redis_client = celery_app.backend.client
        progress_key = f"datenschleuder:job-progress:{run_id}"
        completed = redis_client.get(progress_key)

        if completed is None:
            # No progress tracking for this job (maybe sequential mode)
            return {
                "status": "running",
                "completed": None,
                "total": None,
                "percentage": None,
                "message": "Progress tracking not available for this job",
            }

        completed = int(completed)

        # Try to get total from result field (set during job start)
        result = run.get("result", {})
        total = result.get("total_devices") if isinstance(result, dict) else None

        percentage = int((completed / total) * 100) if total and total > 0 else None

        return {
            "status": "running",
            "completed": completed,
            "total": total,
            "percentage": percentage,
            "message": f"Backed up {completed} devices"
            + (f" of {total}" if total else ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error getting progress for job run %s: %s", run_id, e, exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule/{schedule_id}")
async def get_schedule_runs(
    schedule_id: int,
    limit: int = Query(50, ge=1, le=200, description="Number of runs to return"),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """
    Get job runs for a specific schedule.
    """
    try:
        runs = job_run_manager.get_schedule_runs(schedule_id, limit=limit)
        return runs
    except Exception as e:
        logger.error(
            "Error getting runs for schedule %s: %s", schedule_id, e, exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{run_id}/cancel")
async def cancel_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """
    Cancel a pending or running job.

    Note: This marks the job as cancelled but may not stop a running Celery task.
    """
    try:
        run = job_run_manager.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")

        if run["status"] in ["completed", "failed", "cancelled"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel job with status: {run['status']}",
            )

        # Try to revoke the Celery task if we have a task ID
        if run.get("celery_task_id"):
            try:
                from celery_app import celery_app

                celery_app.control.revoke(run["celery_task_id"], terminate=True)
            except Exception as e:
                logger.warning("Could not revoke Celery task: %s", e)

        updated = job_run_manager.mark_cancelled(run_id)
        if updated:
            return {"message": f"Job run {run_id} cancelled", "job_run": updated}

        raise HTTPException(status_code=500, detail="Failed to cancel job run")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error cancelling job run %s: %s", run_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cleanup")
async def cleanup_old_runs(
    days: int = Query(
        30, ge=1, le=365, description="Delete runs older than this many days"
    ),
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """
    Clean up old job runs (admin only).
    """
    try:
        count = job_run_manager.cleanup_old_runs(days=days)
        return {"message": f"Cleaned up {count} old job runs", "deleted_count": count}
    except Exception as e:
        logger.error("Error cleaning up job runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear-all")
async def clear_all_runs(
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """
    Clear all job run history.
    """
    try:
        count = job_run_manager.clear_all_runs()
        return {"message": f"Cleared {count} job runs", "deleted_count": count}
    except Exception as e:
        logger.error("Error clearing job runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear-filtered")
async def clear_filtered_runs(
    status: Optional[str] = Query(
        None, description="Filter by status (comma-separated for multiple)"
    ),
    job_type: Optional[str] = Query(
        None, description="Filter by job type (comma-separated for multiple)"
    ),
    triggered_by: Optional[str] = Query(
        None, description="Filter by trigger type (comma-separated for multiple)"
    ),
    template_id: Optional[str] = Query(
        None, description="Filter by template ID (comma-separated for multiple)"
    ),
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """
    Clear job runs matching the specified filters.
    Does not delete pending or running jobs.
    Supports comma-separated values for multiple selections.
    """
    try:
        # Parse comma-separated values into lists
        status_list = status.split(",") if status else None
        job_type_list = job_type.split(",") if job_type else None
        triggered_by_list = triggered_by.split(",") if triggered_by else None
        template_id_list = (
            [int(t) for t in template_id.split(",") if t.isdigit()]
            if template_id
            else None
        )

        count = job_run_manager.clear_filtered_runs(
            status=status_list,
            job_type=job_type_list,
            triggered_by=triggered_by_list,
            template_id=template_id_list,
        )
        filters = []
        if status:
            filters.append(f"status={status}")
        if job_type:
            filters.append(f"type={job_type}")
        if triggered_by:
            filters.append(f"trigger={triggered_by}")
        if template_id:
            filters.append(f"template={template_id}")
        filter_desc = ", ".join(filters) if filters else "all completed"
        return {
            "message": f"Cleared {count} job runs ({filter_desc})",
            "deleted_count": count,
            "filters": {
                "status": status,
                "job_type": job_type,
                "triggered_by": triggered_by,
                "template_id": template_id,
            },
        }
    except Exception as e:
        logger.error("Error clearing filtered job runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{run_id}")
async def delete_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """
    Delete a single job run from history.
    """
    try:
        run = job_run_manager.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")

        # Don't allow deleting running jobs
        if run["status"] in ["pending", "running"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete job with status: {run['status']}. Cancel it first.",
            )

        deleted = job_run_manager.delete_job_run(run_id)
        if deleted:
            return {"message": f"Job run {run_id} deleted", "deleted": True}

        raise HTTPException(status_code=500, detail="Failed to delete job run")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting job run %s: %s", run_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute/{schedule_id}")
async def execute_job_manually(
    schedule_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """
    Execute a job schedule manually (trigger immediate run).
    """
    try:
        import jobs_manager
        import job_template_manager
        from tasks import dispatch_job

        # Get the schedule
        logger.info("Executing schedule %s manually", schedule_id)
        schedule = jobs_manager.get_job_schedule(schedule_id)
        if not schedule:
            logger.error("Schedule %s not found", schedule_id)
            raise HTTPException(
                status_code=404, detail=f"Schedule {schedule_id} not found"
            )

        logger.info("Schedule found: %s", schedule.get("job_identifier"))

        # Get the template
        template_id = schedule.get("job_template_id")
        if not template_id:
            logger.error(
                "Schedule %s has no associated template. Schedule data: %s",
                schedule_id,
                schedule,
            )
            raise HTTPException(
                status_code=400,
                detail="Schedule has no associated template. Please edit the schedule and select a job template.",
            )

        logger.info("Template ID: %s", template_id)
        template = job_template_manager.get_job_template(template_id)
        if not template:
            logger.error("Template %s not found in database", template_id)
            raise HTTPException(
                status_code=404, detail=f"Template {template_id} not found"
            )

        # Dispatch the job
        task = dispatch_job.delay(
            schedule_id=schedule_id,
            template_id=template_id,
            job_name=schedule.get("job_identifier", f"manual-{schedule_id}"),
            job_type=template.get("job_type"),
            credential_id=schedule.get("credential_id"),
            job_parameters=schedule.get("job_parameters"),
            triggered_by="manual",
            executed_by=current_user.get("username", "unknown"),
        )

        return {
            "message": "Job dispatched successfully",
            "celery_task_id": task.id,
            "schedule_id": schedule_id,
            "job_name": schedule.get("job_identifier"),
            "job_type": template.get("job_type"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error executing job manually: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
