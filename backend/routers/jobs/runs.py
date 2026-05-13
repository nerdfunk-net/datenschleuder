"""
Job Runs Router
API endpoints for viewing and managing job run history.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.auth import require_permission
from core.database import get_db
from core.safe_http_errors import raise_internal_server_error
from models.jobs import JobRunListResponse, JobRunResponse
from services.jobs.execution_service import JobExecutionService
from services.jobs.filter_service import parse_comma_separated_filters
from services.jobs.job_run_service import JobRunService
from services.jobs.progress_service import JobProgressService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/job-runs", tags=["job-runs"])


def get_job_run_service(db: Session = Depends(get_db)) -> JobRunService:
    return JobRunService(db=db)


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
    service: JobRunService = Depends(get_job_run_service),
):
    """List job runs with pagination and optional filters."""
    try:
        filters = parse_comma_separated_filters(
            status, job_type, triggered_by, template_id
        )
        return service.list_job_runs(
            page=page,
            page_size=page_size,
            status=filters["status_list"],
            job_type=filters["job_type_list"],
            triggered_by=filters["triggered_by_list"],
            schedule_id=schedule_id,
            template_id=filters["template_id_list"],
        )
    except Exception as e:
        raise_internal_server_error(log_message="Error listing job runs", exc=e, operation="list_job_runs")


@router.get("/templates")
def get_distinct_templates(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Get distinct templates used in job runs (for filter dropdown)."""
    try:
        return {"templates": service.get_distinct_templates()}
    except Exception as e:
        raise_internal_server_error(log_message="Error getting templates", exc=e, operation="get_templates")


@router.get("/recent")
def get_recent_runs(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Get recent job runs (simplified endpoint for dashboard)."""
    try:
        return service.get_recent_runs(limit=limit, status=status, job_type=job_type)
    except Exception as e:
        raise_internal_server_error(log_message="Error getting recent runs", exc=e, operation="get_recent_runs")


@router.get("/stats")
def get_job_stats(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Get job queue statistics."""
    try:
        return service.get_queue_stats()
    except Exception as e:
        raise_internal_server_error(log_message="Error getting job stats", exc=e, operation="get_job_stats")


@router.get("/dashboard/stats")
def get_dashboard_stats(
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Get dashboard statistics for job runs."""
    try:
        return service.get_dashboard_stats()
    except Exception as e:
        raise_internal_server_error(log_message="Error getting dashboard stats", exc=e, operation="get_dashboard_stats")


@router.get("/{run_id}", response_model=JobRunResponse)
def get_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Get a specific job run by ID."""
    try:
        run = service.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")
        return run
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(log_message="Error getting job run", exc=e, operation="get_job_run")


@router.get("/{run_id}/progress")
def get_job_progress(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Get progress information for a running job."""
    try:
        return JobProgressService().get_progress(run_id, service)
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(log_message="Error getting job progress", exc=e, operation="get_job_progress")


@router.get("/schedule/{schedule_id}")
def get_schedule_runs(
    schedule_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Get job runs for a specific schedule."""
    try:
        return service.get_schedule_runs(schedule_id, limit=limit)
    except Exception as e:
        raise_internal_server_error(log_message="Error getting schedule runs", exc=e, operation="get_schedule_runs")


@router.post("/{run_id}/cancel")
def cancel_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Cancel a pending or running job."""
    try:
        return JobExecutionService().cancel_job(run_id, service)
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(log_message="Error cancelling job run", exc=e, operation="cancel_job_run")


@router.delete("/cleanup")
def cleanup_old_runs(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Clean up old job runs."""
    try:
        count = service.cleanup_old_runs(days=days)
        return {"message": f"Cleaned up {count} old job runs", "deleted_count": count}
    except Exception as e:
        raise_internal_server_error(log_message="Error cleaning up job runs", exc=e, operation="cleanup_old_runs")


@router.delete("/clear-all")
def clear_all_runs(
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Clear all job run history."""
    try:
        count = service.clear_all_runs()
        return {"message": f"Cleared {count} job runs", "deleted_count": count}
    except Exception as e:
        raise_internal_server_error(log_message="Error clearing job runs", exc=e, operation="clear_all_runs")


@router.delete("/clear-filtered")
def clear_filtered_runs(
    status: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    triggered_by: Optional[str] = Query(None),
    template_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Clear job runs matching the specified filters."""
    try:
        filters = parse_comma_separated_filters(
            status, job_type, triggered_by, template_id
        )
        count = service.clear_filtered_runs(
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
        raise_internal_server_error(log_message="Error clearing filtered job runs", exc=e, operation="clear_filtered_runs")


@router.delete("/{run_id}")
def delete_job_run(
    run_id: int,
    current_user: dict = Depends(require_permission("jobs.runs", "execute")),
    service: JobRunService = Depends(get_job_run_service),
):
    """Delete a single job run from history."""
    try:
        run = service.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")
        if run["status"] in ["pending", "running"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete job with status: {run['status']}. Cancel it first.",
            )
        if service.delete_job_run(run_id):
            return {"message": f"Job run {run_id} deleted", "deleted": True}
        raise_internal_server_error(log_message="Failed to delete job run", operation="delete_job_run")
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(log_message="Error deleting job run", exc=e, operation="delete_job_run")


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
        raise_internal_server_error(log_message="Error executing job manually", exc=e, operation="execute_job_manually")
