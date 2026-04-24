"""Job Execution Service.

Handles manual job dispatching and job cancellation.
Shared by both the job-runs and job-schedules routers.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)


class JobExecutionService:
    """Service for manually executing and cancelling jobs."""

    def execute_schedule(
        self,
        schedule_id: int,
        executed_by: str,
        override_parameters: Optional[dict] = None,
    ) -> dict:
        """Dispatch a job schedule for immediate execution.

        Args:
            schedule_id: ID of the schedule to run.
            executed_by: Username of the triggering user.
            override_parameters: Optional parameter overrides merged on top of schedule params.

        Returns:
            Dict with celery_task_id, schedule_id, job_name, job_type, status.

        Raises:
            HTTPException 404 if schedule or template not found.
            HTTPException 400 if schedule has no associated template.
        """
        from services.jobs.job_schedule_service import JobScheduleService
        from services.jobs.job_template_service import JobTemplateService
        from tasks import dispatch_job

        schedule = JobScheduleService().get_job_schedule(schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=404, detail=f"Schedule {schedule_id} not found"
            )

        template_id = schedule.get("job_template_id")
        if not template_id:
            raise HTTPException(
                status_code=400,
                detail="Schedule has no associated template. Please edit the schedule and select a job template.",
            )

        template = JobTemplateService().get_job_template(template_id)
        if not template:
            raise HTTPException(
                status_code=404, detail=f"Template {template_id} not found"
            )

        job_parameters = dict(schedule.get("job_parameters") or {})
        if override_parameters:
            job_parameters.update(override_parameters)

        task = dispatch_job.delay(
            schedule_id=schedule_id,
            template_id=template_id,
            job_name=schedule.get("job_identifier", f"manual-{schedule_id}"),
            job_type=template.get("job_type"),
            credential_id=schedule.get("credential_id"),
            job_parameters=job_parameters if job_parameters else None,
            triggered_by="manual",
            executed_by=executed_by,
        )

        logger.info(
            "Job dispatched: %s (task_id=%s) by %s",
            schedule.get("job_identifier"),
            task.id,
            executed_by,
        )

        return {
            "celery_task_id": task.id,
            "schedule_id": schedule_id,
            "job_name": schedule.get("job_identifier"),
            "job_type": template.get("job_type"),
            "status": "queued",
        }

    def cancel_job(self, run_id: int, job_run_manager) -> dict:
        """Cancel a pending or running job.

        Args:
            run_id: Job run ID.
            job_run_manager: JobRunService instance.

        Returns:
            Dict with message and job_run.

        Raises:
            HTTPException 404 if run not found.
            HTTPException 400 if job is already in a terminal state.
            HTTPException 500 if cancellation fails.
        """
        run = job_run_manager.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")

        if run["status"] in ["completed", "failed", "cancelled"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel job with status: {run['status']}",
            )

        self._revoke_celery_task(run.get("celery_task_id"))

        updated = job_run_manager.mark_cancelled(run_id)
        if updated:
            return {"message": f"Job run {run_id} cancelled", "job_run": updated}

        raise HTTPException(status_code=500, detail="Failed to cancel job run")

    def _revoke_celery_task(self, celery_task_id: Optional[str]) -> None:
        """Attempt to revoke a Celery task; log a warning on failure."""
        if not celery_task_id:
            return
        try:
            from celery_app import celery_app

            celery_app.control.revoke(celery_task_id, terminate=True)
        except Exception as e:
            logger.warning("Could not revoke Celery task %s: %s", celery_task_id, e)
