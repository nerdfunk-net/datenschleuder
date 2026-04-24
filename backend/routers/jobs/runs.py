"""
Job Runs Router
API endpoints for viewing and managing job run history.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import require_permission
from models.jobs import JobRunResponse, JobRunListResponse
from services.jobs.execution_service import JobExecutionService
from services.jobs.filter_service import parse_comma_separated_filters
from services.jobs.job_run_service import JobRunService as _JobRunService
from services.jobs.progress_service import JobProgressService

job_run_manager = _JobRunService()
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/job-runs", tags=["job-runs"])


@router.get("", response_model=JobRunListResponse)
def list_job_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    triggered_by: Optional[str] = Query(None),
    schedule_id: Optional[int] = Query(None),
    template_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """List job runs with pagination and optional filters."""
    try:
        filters = parse_comma_separated_filters(
            status, job_type, triggered_by, template_id
        )
        return job_run_manager.list_job_runs(
            page=page,
            page_size=page_size,
            status=filters["status_list"],
            job_type=filters["job_type_list"],
            triggered_by=filters["triggered_by_list"],
            schedule_id=schedule_id,
            template_id=filters["template_id_list"],
        )
    except Exception as e:
        logger.error("Error listing job runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
def get_distinct_templates(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """Get distinct templates used in job runs (for filter dropdown)."""
    try:
        return {"templates": job_run_manager.get_distinct_templates()}
    except Exception as e:
        logger.error("Error getting templates: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
def get_recent_runs(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """Get recent job runs (simplified endpoint for dashboard)."""
    try:
        return job_run_manager.get_recent_runs(
            limit=limit, status=status, job_type=job_type
        )
    except Exception as e:
        logger.error("Error getting recent runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
def get_job_stats(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """Get job queue statistics."""
    try:
        return job_run_manager.get_queue_stats()
    except Exception as e:
        logger.error("Error getting job stats: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/stats")
def get_dashboard_stats(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """Get dashboard statistics for job runs."""
    try:
        return job_run_manager.get_dashboard_stats()
    except Exception as e:
        logger.error("Error getting dashboard stats: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{run_id}", response_model=JobRunResponse)
def get_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """Get a specific job run by ID."""
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
def get_job_progress(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """Get progress information for a running job."""
    try:
        return JobProgressService().get_progress(run_id, job_run_manager)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error getting progress for job run %s: %s", run_id, e, exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule/{schedule_id}")
def get_schedule_runs(
    schedule_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    """Get job runs for a specific schedule."""
    try:
        return job_run_manager.get_schedule_runs(schedule_id, limit=limit)
    except Exception as e:
        logger.error(
            "Error getting runs for schedule %s: %s", schedule_id, e, exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{run_id}/cancel")
def cancel_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """Cancel a pending or running job."""
    try:
        return JobExecutionService().cancel_job(run_id, job_run_manager)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error cancelling job run %s: %s", run_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cleanup")
def cleanup_old_runs(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """Clean up old job runs."""
    try:
        count = job_run_manager.cleanup_old_runs(days=days)
        return {"message": f"Cleaned up {count} old job runs", "deleted_count": count}
    except Exception as e:
        logger.error("Error cleaning up job runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear-all")
def clear_all_runs(
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """Clear all job run history."""
    try:
        count = job_run_manager.clear_all_runs()
        return {"message": f"Cleared {count} job runs", "deleted_count": count}
    except Exception as e:
        logger.error("Error clearing job runs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear-filtered")
def clear_filtered_runs(
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    triggered_by: Optional[str] = Query(None),
    template_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """Clear job runs matching the specified filters."""
    try:
        filters = parse_comma_separated_filters(
            status, job_type, triggered_by, template_id
        )
        count = job_run_manager.clear_filtered_runs(
            status=filters["status_list"],
            job_type=filters["job_type_list"],
            triggered_by=filters["triggered_by_list"],
            template_id=filters["template_id_list"],
        )
        filter_parts = []
        if status:
            filter_parts.append(f"status={status}")
        if job_type:
            filter_parts.append(f"type={job_type}")
        if triggered_by:
            filter_parts.append(f"trigger={triggered_by}")
        if template_id:
            filter_parts.append(f"template={template_id}")
        filter_desc = ", ".join(filter_parts) if filter_parts else "all completed"
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
def delete_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
):
    """Delete a single job run from history."""
    try:
        run = job_run_manager.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")
        if run["status"] in ["pending", "running"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete job with status: {run['status']}. Cancel it first.",
            )
        if job_run_manager.delete_job_run(run_id):
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
    """Execute a job schedule manually (trigger immediate run)."""
    try:
        result = JobExecutionService().execute_schedule(
            schedule_id=schedule_id,
            executed_by=current_user.get("username", "unknown"),
        )
        return {"message": "Job dispatched successfully", **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error executing job manually: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
