"""Job Progress Service.

Retrieves real-time progress information for running jobs from Redis.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

_PROGRESS_KEY_PREFIX = "datenschleuder:job-progress"


class JobProgressService:
    """Service for reading job progress from Redis."""

    def get_progress(self, run_id: int, job_run_manager) -> dict:
        """Return progress information for a job run.

        Args:
            run_id: Job run ID.
            job_run_manager: JobRunService instance for looking up run state.

        Returns:
            Progress dict with keys: status, completed, total, percentage, message.

        Raises:
            HTTPException 404 if run not found.
        """
        from celery_app import celery_app

        run = job_run_manager.get_job_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Job run {run_id} not found")

        if run["status"] != "running":
            return {
                "status": run["status"],
                "completed": None,
                "total": None,
                "percentage": None,
            }

        redis_client = celery_app.backend.client
        progress_key = f"{_PROGRESS_KEY_PREFIX}:{run_id}"
        raw = redis_client.get(progress_key)

        if raw is None:
            return {
                "status": "running",
                "completed": None,
                "total": None,
                "percentage": None,
                "message": "Progress tracking not available for this job",
            }

        completed = int(raw)
        result = run.get("result", {})
        total = result.get("total_devices") if isinstance(result, dict) else None
        percentage = self._calculate_percentage(completed, total)

        return {
            "status": "running",
            "completed": completed,
            "total": total,
            "percentage": percentage,
            "message": f"Backed up {completed} devices"
            + (f" of {total}" if total else ""),
        }

    def _calculate_percentage(
        self, completed: int, total: Optional[int]
    ) -> Optional[int]:
        if total and total > 0:
            return int((completed / total) * 100)
        return None
