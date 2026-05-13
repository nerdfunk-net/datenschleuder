"""
Job Schedule Management Router
API endpoints for managing scheduled jobs via Celery Beat.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission, verify_token
from core.safe_http_errors import raise_internal_server_error
from models.jobs import (
    JobExecutionRequest,
    JobScheduleCreate,
    JobScheduleResponse,
    JobScheduleUpdate,
)
from services.jobs.execution_service import JobExecutionService
from services.jobs.job_schedule_service import JobScheduleService
from services.jobs.schedule_authorization_service import JobScheduleAuthorizationService
from services.jobs.scheduler_debug_service import JobSchedulerDebugService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/job-schedules", tags=["job-schedules"])


def get_job_schedule_service() -> JobScheduleService:
    return JobScheduleService()


def get_schedule_auth_service() -> JobScheduleAuthorizationService:
    return JobScheduleAuthorizationService()


@router.post(
    "", response_model=JobScheduleResponse, status_code=status.HTTP_201_CREATED
)
def create_job_schedule(
    job_data: JobScheduleCreate,
    current_user: dict = Depends(verify_token),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
    auth_service: JobScheduleAuthorizationService = Depends(get_schedule_auth_service),
):
    """Create a new job schedule."""
    try:
        auth_service.check_create_permission(current_user, job_data.is_global)

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
        raise_internal_server_error(log_message="Failed to create job schedule", exc=e, operation="create_job_schedule")


@router.get("", response_model=List[JobScheduleResponse])
def list_job_schedules(
    is_global: Optional[bool] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(verify_token),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
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
        raise_internal_server_error(log_message="Failed to list job schedules", exc=e, operation="list_job_schedules")


@router.get("/{job_id}", response_model=JobScheduleResponse)
def get_job_schedule(
    job_id: int,
    current_user: dict = Depends(verify_token),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
    auth_service: JobScheduleAuthorizationService = Depends(get_schedule_auth_service),
):
    """Get a specific job schedule by ID."""
    try:
        job = jobs_manager.get_job_schedule(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )
        auth_service.check_access_permission(current_user, job)
        return JobScheduleResponse(**job)
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(log_message="Failed to get job schedule", exc=e, operation="get_job_schedule")


@router.put("/{job_id}", response_model=JobScheduleResponse)
def update_job_schedule(
    job_id: int,
    job_update: JobScheduleUpdate,
    current_user: dict = Depends(verify_token),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
    auth_service: JobScheduleAuthorizationService = Depends(get_schedule_auth_service),
):
    """Update a job schedule."""
    try:
        job = jobs_manager.get_job_schedule(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        auth_service.check_update_permission(current_user, job)

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
        raise_internal_server_error(log_message="Failed to update job schedule", exc=e, operation="update_job_schedule")


@router.delete("/{job_id}")
def delete_job_schedule(
    job_id: int,
    current_user: dict = Depends(verify_token),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
    auth_service: JobScheduleAuthorizationService = Depends(get_schedule_auth_service),
):
    """Delete a job schedule."""
    try:
        job = jobs_manager.get_job_schedule(job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        auth_service.check_delete_permission(current_user, job)

        if not jobs_manager.delete_job_schedule(job_id):
            raise_internal_server_error(log_message="Failed to delete job schedule", operation="delete_job_schedule")
        return {"message": "Job schedule deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(log_message="Failed to delete job schedule", exc=e, operation="delete_job_schedule")


@router.post("/execute")
def execute_job(
    execution_request: JobExecutionRequest,
    current_user: dict = Depends(verify_token),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
    auth_service: JobScheduleAuthorizationService = Depends(get_schedule_auth_service),
):
    """Execute a job immediately."""
    try:
        job = jobs_manager.get_job_schedule(execution_request.job_schedule_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found"
            )

        auth_service.check_access_permission(current_user, job)

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
        raise_internal_server_error(log_message="Failed to execute job", exc=e, operation="execute_job")


@router.get("/debug/scheduler-status")
def get_scheduler_debug_status(
    current_user: dict = Depends(verify_token),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
):
    """Get detailed scheduler debug information."""
    try:
        return JobSchedulerDebugService().get_scheduler_status(jobs_manager)
    except Exception as e:
        raise_internal_server_error(log_message="Failed to get scheduler status", exc=e, operation="get_scheduler_status")


@router.post("/debug/recalculate-next-runs")
def recalculate_all_next_runs(
    current_user: dict = Depends(require_permission("jobs", "write")),
    jobs_manager: JobScheduleService = Depends(get_job_schedule_service),
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
        raise_internal_server_error(log_message="Failed to recalculate next runs", exc=e, operation="recalculate_next_runs")
