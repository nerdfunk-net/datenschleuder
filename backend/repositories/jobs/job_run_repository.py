"""
JobRun Repository
Handles database operations for job run tracking.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from core.models import JobRun
from repositories.base import BaseRepository


def _to_dict(job_run: JobRun) -> Dict[str, Any]:
    """Convert JobRun to dictionary while session is still active"""
    return {
        "id": job_run.id,
        "job_schedule_id": job_run.job_schedule_id,
        "job_template_id": job_run.job_template_id,
        "celery_task_id": job_run.celery_task_id,
        "job_name": job_run.job_name,
        "job_type": job_run.job_type,
        "status": job_run.status,
        "triggered_by": job_run.triggered_by,
        "queued_at": job_run.queued_at,
        "started_at": job_run.started_at,
        "completed_at": job_run.completed_at,
        "error_message": job_run.error_message,
        "result": job_run.result,
        "target_devices": job_run.target_devices,
        "executed_by": job_run.executed_by,
    }


class JobRunRepository(BaseRepository[JobRun]):
    """Repository for job run operations"""

    def __init__(self):
        super().__init__(JobRun)

    def create(self, db: Session, **kwargs) -> Dict[str, Any]:  # type: ignore[override]
        """Create a new job run and return as dict"""
        try:
            instance = self.model(**kwargs)
            db.add(instance)
            db.commit()
            db.refresh(instance)
            return _to_dict(instance)
        except Exception:
            db.rollback()
            raise

    def get_by_id(self, db: Session, id: int) -> Optional[Dict[str, Any]]:  # type: ignore[override]
        """Get job run by ID and return as dict"""
        job_run = db.query(self.model).filter(self.model.id == id).first()
        return _to_dict(job_run) if job_run else None

    def delete(self, db: Session, id: int) -> bool:  # type: ignore[override]
        """Delete a job run by ID"""
        try:
            obj = db.query(self.model).filter(self.model.id == id).first()
            if obj:
                db.delete(obj)
                db.commit()
                return True
            return False
        except Exception:
            db.rollback()
            raise

    def get_by_celery_task_id(self, db: Session, celery_task_id: str) -> Optional[Dict[str, Any]]:
        """Get job run by Celery task ID"""
        job_run = (
            db.query(self.model)
            .filter(self.model.celery_task_id == celery_task_id)
            .first()
        )
        return _to_dict(job_run) if job_run else None

    def get_by_celery_task_ids(self, db: Session, celery_task_ids: List[str]) -> List[Dict[str, Any]]:
        """Get job runs by multiple Celery task IDs"""
        if not celery_task_ids:
            return []
        job_runs = (
            db.query(self.model)
            .filter(self.model.celery_task_id.in_(celery_task_ids))
            .all()
        )
        return [_to_dict(job_run) for job_run in job_runs]

    def get_by_schedule(
        self, db: Session, schedule_id: int, limit: int = 50, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get job runs for a specific schedule"""
        query = db.query(self.model).filter(self.model.job_schedule_id == schedule_id)
        if status:
            query = query.filter(self.model.status == status)
        items = query.order_by(desc(self.model.queued_at)).limit(limit).all()
        return [_to_dict(item) for item in items]

    def get_recent_runs(
        self,
        db: Session,
        limit: int = 50,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        triggered_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get recent job runs with optional filters"""
        query = db.query(self.model)
        if status:
            query = query.filter(self.model.status == status)
        if job_type:
            query = query.filter(self.model.job_type == job_type)
        if triggered_by:
            query = query.filter(self.model.triggered_by == triggered_by)
        items = query.order_by(desc(self.model.queued_at)).limit(limit).all()
        return [_to_dict(item) for item in items]

    def get_runs_since(
        self,
        db: Session,
        since: datetime,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        triggered_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get job runs since a specific datetime with optional filters"""
        query = db.query(self.model).filter(self.model.queued_at >= since)
        if status:
            query = query.filter(self.model.status == status)
        if job_type:
            query = query.filter(self.model.job_type == job_type)
        if triggered_by:
            query = query.filter(self.model.triggered_by == triggered_by)
        items = query.order_by(desc(self.model.queued_at)).all()
        return [_to_dict(item) for item in items]

    def get_paginated(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        schedule_id: Optional[int] = None,
        template_id: Optional[List[int]] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        """Get paginated job runs with filters. Returns (items, total_count)"""
        query = db.query(self.model)

        if status:
            if len(status) == 1:
                query = query.filter(self.model.status == status[0])
            else:
                query = query.filter(self.model.status.in_(status))
        if job_type:
            if len(job_type) == 1:
                query = query.filter(self.model.job_type == job_type[0])
            else:
                query = query.filter(self.model.job_type.in_(job_type))
        if triggered_by:
            if len(triggered_by) == 1:
                query = query.filter(self.model.triggered_by == triggered_by[0])
            else:
                query = query.filter(self.model.triggered_by.in_(triggered_by))
        if schedule_id:
            query = query.filter(self.model.job_schedule_id == schedule_id)
        if template_id:
            if len(template_id) == 1:
                query = query.filter(self.model.job_template_id == template_id[0])
            else:
                query = query.filter(self.model.job_template_id.in_(template_id))

        total = query.count()
        offset = (page - 1) * page_size
        items = (
            query.order_by(desc(self.model.queued_at))
            .offset(offset)
            .limit(page_size)
            .all()
        )
        return [_to_dict(item) for item in items], total

    def get_running_count(self, db: Session) -> int:
        """Get count of currently running jobs"""
        return db.query(self.model).filter(self.model.status == "running").count()

    def get_pending_count(self, db: Session) -> int:
        """Get count of pending jobs"""
        return db.query(self.model).filter(self.model.status == "pending").count()

    def mark_started(self, db: Session, job_run_id: int, celery_task_id: str) -> Optional[Dict[str, Any]]:
        """Mark a job run as started"""
        try:
            job_run = db.query(self.model).filter(self.model.id == job_run_id).first()
            if job_run:
                job_run.status = "running"
                job_run.started_at = datetime.utcnow()
                job_run.celery_task_id = celery_task_id
                db.commit()
                db.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            db.rollback()
            raise

    def mark_completed(self, db: Session, job_run_id: int, result: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Mark a job run as completed"""
        try:
            job_run = db.query(self.model).filter(self.model.id == job_run_id).first()
            if job_run:
                job_run.status = "completed"
                job_run.completed_at = datetime.utcnow()
                if result:
                    job_run.result = result
                db.commit()
                db.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            db.rollback()
            raise

    def mark_failed(self, db: Session, job_run_id: int, error_message: str) -> Optional[Dict[str, Any]]:
        """Mark a job run as failed"""
        try:
            job_run = db.query(self.model).filter(self.model.id == job_run_id).first()
            if job_run:
                job_run.status = "failed"
                job_run.completed_at = datetime.utcnow()
                job_run.error_message = error_message
                db.commit()
                db.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            db.rollback()
            raise

    def mark_cancelled(self, db: Session, job_run_id: int) -> Optional[Dict[str, Any]]:
        """Mark a job run as cancelled"""
        try:
            job_run = db.query(self.model).filter(self.model.id == job_run_id).first()
            if job_run:
                job_run.status = "cancelled"
                job_run.completed_at = datetime.utcnow()
                db.commit()
                db.refresh(job_run)
                return _to_dict(job_run)
            return None
        except Exception:
            db.rollback()
            raise

    def cleanup_old_runs(self, db: Session, days: int = 30) -> int:
        """Delete job runs older than specified days. Returns count deleted."""
        from datetime import timedelta

        try:
            cutoff = datetime.utcnow() - timedelta(days=days)
            result = db.query(self.model).filter(self.model.queued_at < cutoff).delete()
            db.commit()
            return result
        except Exception:
            db.rollback()
            raise

    def cleanup_old_runs_hours(self, db: Session, hours: int = 24) -> int:
        """Delete job runs older than specified hours. Returns count deleted."""
        from datetime import timedelta

        try:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            result = (
                db.query(self.model)
                .filter(
                    self.model.queued_at < cutoff,
                    self.model.status.in_(["completed", "failed", "cancelled"]),
                )
                .delete(synchronize_session=False)
            )
            db.commit()
            return result
        except Exception:
            db.rollback()
            raise

    def clear_all(self, db: Session) -> int:
        """Delete all job runs. Returns count deleted."""
        try:
            result = db.query(self.model).delete()
            db.commit()
            return result
        except Exception:
            db.rollback()
            raise

    def clear_filtered(
        self,
        db: Session,
        status: Optional[List[str]] = None,
        job_type: Optional[List[str]] = None,
        triggered_by: Optional[List[str]] = None,
        template_id: Optional[List[int]] = None,
    ) -> int:
        """Delete job runs matching filters. Returns count deleted."""
        try:
            query = db.query(self.model)
            query = query.filter(self.model.status.notin_(["pending", "running"]))

            if status:
                if len(status) == 1:
                    query = query.filter(self.model.status == status[0])
                else:
                    query = query.filter(self.model.status.in_(status))
            if job_type:
                if len(job_type) == 1:
                    query = query.filter(self.model.job_type == job_type[0])
                else:
                    query = query.filter(self.model.job_type.in_(job_type))
            if triggered_by:
                if len(triggered_by) == 1:
                    query = query.filter(self.model.triggered_by == triggered_by[0])
                else:
                    query = query.filter(self.model.triggered_by.in_(triggered_by))
            if template_id:
                if len(template_id) == 1:
                    query = query.filter(self.model.job_template_id == template_id[0])
                else:
                    query = query.filter(self.model.job_template_id.in_(template_id))

            result = query.delete(synchronize_session="fetch")
            db.commit()
            return result
        except Exception:
            db.rollback()
            raise

    def get_aggregate_stats(self, db: Session) -> Dict[str, Any]:
        """Return status counts using ORM aggregations."""
        from sqlalchemy import case, func

        result = db.query(
            func.count().label("total"),
            func.sum(case((self.model.status == "completed", 1), else_=0)).label("completed"),
            func.sum(case((self.model.status == "failed", 1), else_=0)).label("failed"),
            func.sum(case((self.model.status == "running", 1), else_=0)).label("running"),
        ).one()
        return {
            "total": result.total or 0,
            "completed": result.completed or 0,
            "failed": result.failed or 0,
            "running": result.running or 0,
        }

    def get_recent_backup_results(self, db: Session, days: int = 30) -> List[Any]:
        """Return result JSON strings from completed backup jobs in the last N days."""
        from datetime import timedelta, timezone

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        rows = (
            db.query(self.model.result)
            .filter(
                self.model.job_type == "backup",
                self.model.status == "completed",
                self.model.queued_at >= cutoff,
            )
            .all()
        )
        return [row.result for row in rows]

    def get_distinct_templates(self, db: Session) -> List[Dict[str, Any]]:
        """Get distinct templates used in job runs."""
        from sqlalchemy import func

        results = (
            db.query(
                self.model.job_template_id,
                func.max(self.model.job_name).label("template_name"),
            )
            .filter(self.model.job_template_id.isnot(None))
            .group_by(self.model.job_template_id)
            .order_by(func.max(self.model.job_name))
            .all()
        )
        return [
            {
                "id": r.job_template_id,
                "name": r.template_name or f"Template {r.job_template_id}",
            }
            for r in results
        ]


# Singleton instance — stateless; db session injected per call
job_run_repository = JobRunRepository()
