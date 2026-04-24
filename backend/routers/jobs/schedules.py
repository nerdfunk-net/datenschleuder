"""
Job Schedule Management Router
API endpoints for managing scheduled jobs via Celery Beat.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from core.auth import verify_token, require_permission
from models.jobs import (
    JobScheduleCreate,
    JobScheduleUpdate,
    JobScheduleResponse,
    JobExecutionRequest,
)
from services.jobs.execution_service import JobExecutionService
from services.jobs.job_schedule_service import JobScheduleService as _JobScheduleService
from services.jobs.schedule_authorization_service import JobScheduleAuthorizationService
from services.jobs.scheduler_debug_service import JobSchedulerDebugService
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/job-schedules", tags=["job-schedules"])

jobs_manager = _JobScheduleService()
_auth_service = JobScheduleAuthorizationService()


@router.post(
    "", response_model=JobScheduleResponse, status_code=status.HTTP_201_CREATED
)
def create_job_schedule(
    job_data: JobScheduleCreate,
    current_user: dict = Depends(verify_token),
):
    """Create a new job schedule."""
    try:
        _auth_service.check_create_permission(current_user, job_data.is_global)

        if not job_data.is_global:
            job_data.user_id = current_user["user_id"]

        job_schedule = jobs_manager.create_job_schedule(
            job_identifier=job_data.job_identifier,
            job_template_id=job_data.job_template_id,
            schedule_type=job_data.schedule_type,
            cron_expression=job_data.cron_expression,
            interval_minutes=job_data.interval_minutes,
            start_time=job_data.start_time,
            start_date=job_data.start_date,
            is_active=job_data.is_active,
            is_global=job_data.is_global,
            user_id=job_data.user_id,
            credential_id=job_data.credential_id,
            job_parameters=job_data.job_parameters,
        )
        return JobScheduleResponse(**job_schedule)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating job schedule: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job schedule: {str(e)}",
        )


@router.get("", response_model=List[JobScheduleResponse])
def list_job_schedules(
    is_global: Optional[bool] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(verify_token),
):
    """List all job schedules accessible to the current user."""
    try:
        jobs = jobs_manager.get_user_job_schedules(current_user["user_id"])
        if is_global is not None:
            jobs = [j for j in jobs if j.get("is_global") == is_global]
        if is_active is not None:
            jobs = [j for j in jobs if j.get("is_active") == is_active]
        return [JobScheduleResponse(**job) for job in jobs]
    except Exception as e:
        logger.error("Error listing job schedules: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list job schedules: {str(e)}",
        )


@router.get("/{job_id}", response_model=JobScheduleResponse)
def get_job_schedule(
    job_id: int,
    current_user: dict = Depends(verify_token),
):
    """Get a specific job schedule by ID."""
    try:
        job = jobs_manager.get_job_schedule(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )
        _auth_service.check_access_permission(current_user, job)
        return JobScheduleResponse(**job)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting job schedule: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job schedule: {str(e)}",
        )


@router.put("/{job_id}", response_model=JobScheduleResponse)
def update_job_schedule(
    job_id: int,
    job_update: JobScheduleUpdate,
    current_user: dict = Depends(verify_token),
):
    """Update a job schedule."""
    try:
        job = jobs_manager.get_job_schedule(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        _auth_service.check_update_permission(current_user, job)

        updated_job = jobs_manager.update_job_schedule(
            job_id=job_id,
            job_identifier=job_update.job_identifier,
            schedule_type=job_update.schedule_type,
            cron_expression=job_update.cron_expression,
            interval_minutes=job_update.interval_minutes,
            start_time=job_update.start_time,
            start_date=job_update.start_date,
            is_active=job_update.is_active,
            credential_id=job_update.credential_id,
            job_parameters=job_update.job_parameters,
        )
        return JobScheduleResponse(**updated_job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating job schedule: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update job schedule: {str(e)}",
        )


@router.delete("/{job_id}")
def delete_job_schedule(
    job_id: int,
    current_user: dict = Depends(verify_token),
):
    """Delete a job schedule."""
    try:
        job = jobs_manager.get_job_schedule(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        _auth_service.check_delete_permission(current_user, job)

        if not jobs_manager.delete_job_schedule(job_id):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete job schedule",
            )
        return {"message": "Job schedule deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting job schedule: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job schedule: {str(e)}",
        )


@router.post("/execute")
def execute_job(
    execution_request: JobExecutionRequest,
    current_user: dict = Depends(verify_token),
):
    """Execute a job immediately."""
    try:
        job = jobs_manager.get_job_schedule(execution_request.job_schedule_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        _auth_service.check_access_permission(current_user, job)

        result = JobExecutionService().execute_schedule(
            schedule_id=execution_request.job_schedule_id,
            executed_by=current_user.get("username", "unknown"),
            override_parameters=execution_request.override_parameters,
        )

        logger.info(
            "Job execution started: %s (task_id=%s) by user %s",
            result["job_name"],
            result["celery_task_id"],
            current_user["username"],
        )
        return {
            "message": "Job execution started",
            "job_id": execution_request.job_schedule_id,
            "job_name": result["job_name"],
            "celery_task_id": result["celery_task_id"],
            "status": "queued",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error executing job: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute job: {str(e)}",
        )


@router.get("/debug/scheduler-status")
def get_scheduler_debug_status(current_user: dict = Depends(verify_token)):
    """Get detailed scheduler debug information."""
    try:
        return JobSchedulerDebugService().get_scheduler_status(jobs_manager)
    except Exception as e:
        logger.error("Error getting scheduler debug status: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get scheduler status: {str(e)}",
        )


@router.post("/debug/recalculate-next-runs")
def recalculate_all_next_runs(
    current_user: dict = Depends(require_permission("jobs", "write")),
):
    """Recalculate next_run for all active schedules."""
    try:
        result = jobs_manager.initialize_schedule_next_runs()
        return {
            "success": True,
            "message": f"Recalculated next_run for {result['initialized_count']} schedules",
            "details": result,
        }
    except Exception as e:
        logger.error("Error recalculating next runs: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recalculate next runs: {str(e)}",
        )
