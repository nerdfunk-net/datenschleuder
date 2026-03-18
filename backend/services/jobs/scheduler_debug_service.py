"""Scheduler Debug Service.

Provides comprehensive scheduler diagnostic information.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class JobSchedulerDebugService:
    """Service for scheduler diagnostics."""

    def get_scheduler_status(self, jobs_manager) -> dict:
        """Return detailed scheduler debug information.

        Args:
            jobs_manager: JobScheduleService instance.

        Returns:
            Dict with server_time, schedule_summary, due_schedules,
            upcoming_schedules, celery_status, note.
        """
        now_utc = datetime.now(timezone.utc)
        now_local = datetime.now()

        all_schedules = jobs_manager.list_job_schedules()
        active_schedules = [s for s in all_schedules if s.get("is_active")]

        due_schedules = []
        upcoming_schedules = []

        for schedule in active_schedules:
            next_run = schedule.get("next_run")
            if not next_run:
                continue

            next_run_dt = self._parse_next_run_time(next_run)
            time_diff, is_due = self._calculate_time_until_run(next_run_dt, now_utc)

            schedule_info = {
                "id": schedule["id"],
                "job_identifier": schedule["job_identifier"],
                "schedule_type": schedule["schedule_type"],
                "start_time": schedule.get("start_time"),
                "next_run": schedule.get("next_run"),
                "next_run_local": next_run_dt.astimezone().isoformat() if next_run_dt else None,
                "last_run": schedule.get("last_run"),
                "seconds_until_next_run": int(time_diff),
                "is_due": is_due,
                "template_name": schedule.get("template_name"),
            }

            if is_due:
                due_schedules.append(schedule_info)
            else:
                upcoming_schedules.append(schedule_info)

        upcoming_schedules.sort(key=lambda x: x["seconds_until_next_run"])

        celery_beat_status = self._check_celery_beat_status()

        tz_offset = now_local.astimezone().utcoffset()
        tz_offset_hours = tz_offset.total_seconds() / 3600 if tz_offset else 0

        return {
            "server_time": {
                "utc": now_utc.isoformat(),
                "local": now_local.isoformat(),
                "timezone_offset_hours": tz_offset_hours,
            },
            "schedule_summary": {
                "total_schedules": len(all_schedules),
                "active_schedules": len(active_schedules),
                "due_now": len(due_schedules),
                "upcoming": len(upcoming_schedules),
            },
            "due_schedules": due_schedules,
            "upcoming_schedules": upcoming_schedules[:10],
            "celery_status": celery_beat_status,
            "note": (
                "Times are displayed in UTC. 'start_time' is interpreted as UTC, not local time. "
                "For European time (UTC+1), subtract 1 hour from start_time."
            ),
        }

    def _parse_next_run_time(self, next_run) -> Optional[datetime]:
        """Parse next_run to a timezone-aware datetime."""
        if isinstance(next_run, str):
            next_run_dt = datetime.fromisoformat(next_run.replace("Z", "+00:00"))
        else:
            next_run_dt = next_run

        if next_run_dt and next_run_dt.tzinfo is None:
            next_run_dt = next_run_dt.replace(tzinfo=timezone.utc)
        return next_run_dt

    def _calculate_time_until_run(
        self, next_run_dt: Optional[datetime], now_utc: datetime
    ) -> tuple[float, bool]:
        """Return (seconds_until_run, is_due)."""
        if next_run_dt is None:
            return 0.0, False
        time_diff = (next_run_dt - now_utc).total_seconds()
        return time_diff, time_diff <= 0

    def _check_celery_beat_status(self) -> str:
        """Return a human-readable Celery Beat status string."""
        try:
            from celery_app import celery_app
            inspect = celery_app.control.inspect()
            active_workers = inspect.active()
            return "workers_active" if active_workers else "no_workers_detected"
        except Exception as e:
            return f"error: {str(e)}"
