# Backend Session Pattern

**Related:** `REFACTORE_BACKEND.md` (Phase 6), `CLAUDE.md` (layered backend).  
**Scope:** When and how to inject a SQLAlchemy `Session` through the backend layers.  
**Date:** 2026-05-13

---

## Overview

The project migrates from repository-owned sessions (each method creates and closes its own connection) to **injected sessions** where the caller controls the session lifecycle. Phase 6 establishes the `job_runs` domain as the reference implementation.

---

## Option A — Injected Session (preferred for FastAPI routes)

The session is created once per request by the `Depends(get_db)` dependency and passed down to the service via its constructor. The session is closed when the FastAPI dependency generator exits.

### Router

```python
from sqlalchemy.orm import Session
from core.database import get_db
from services.jobs.job_run_service import JobRunService

def get_job_run_service(db: Session = Depends(get_db)) -> JobRunService:
    return JobRunService(db=db)

@router.get("/{run_id}")
def get_job_run(
    run_id: int,
    service: JobRunService = Depends(get_job_run_service),
    current_user: dict = Depends(require_permission("jobs.runs", "read")),
):
    ...
```

### Service

```python
from sqlalchemy.orm import Session

class JobRunService:
    def __init__(self, db: Session):
        self.db = db

    def get_job_run(self, run_id: int):
        return repo.get_by_id(self.db, run_id)
```

### Repository

All methods accept `db: Session` as their **first positional parameter** after `self`. The method does not create, commit, or close the session — write methods commit via `db.commit()` but lifecycle management belongs to the caller.

```python
def get_by_id(self, db: Session, id: int) -> Optional[Dict[str, Any]]:
    job_run = db.query(self.model).filter(self.model.id == id).first()
    return _to_dict(job_run) if job_run else None

def mark_started(self, db: Session, job_run_id: int, celery_task_id: str) -> Optional[Dict[str, Any]]:
    try:
        job_run = db.query(self.model).filter(self.model.id == job_run_id).first()
        if job_run:
            job_run.status = "running"
            job_run.celery_task_id = celery_task_id
            db.commit()
            db.refresh(job_run)
            return _to_dict(job_run)
        return None
    except Exception:
        db.rollback()
        raise
```

**When to use Option A:**
- All new FastAPI route handlers
- Any code path that starts from an HTTP request

---

## Option B — Caller-managed Session (Celery tasks)

Celery tasks run outside the FastAPI request lifecycle and must create their own sessions. Use `SessionLocal()` directly and close the session in a `finally` block.

```python
from core.database import SessionLocal
from services.jobs.job_run_service import JobRunService

@shared_task(bind=True)
def my_celery_task(self, ...):
    db = SessionLocal()
    try:
        svc = JobRunService(db=db)

        run = svc.create_job_run(...)
        svc.mark_started(run["id"], self.request.id)

        result = do_work(...)

        svc.mark_completed(run["id"], result=result)
        return result
    except Exception as e:
        if run:
            svc.mark_failed(run["id"], str(e))
        raise
    finally:
        db.close()  # always release the connection back to the pool
```

**When to use Option B:**
- Celery tasks (`tasks/`)
- Management commands / scripts
- Any code path that does not go through a FastAPI dependency chain

---

## Decision guide

| Context | Pattern | Session source |
|---------|---------|----------------|
| FastAPI route handler | Option A | `Depends(get_db)` |
| Celery periodic task | Option B | `SessionLocal()` |
| Celery job dispatcher | Option B | `SessionLocal()` |
| pytest integration test | Option B | `sessionmaker(bind=test_engine)()` |

---

## What NOT to do

- **Do not** call `get_db_session()` inside repository methods — that bypasses the injected session.
- **Do not** call `session.close()` inside repository methods — the session lifecycle is the caller's responsibility.
- **Do not** hold a `SessionLocal()` connection open for the full duration of a long Celery task if the work between DB calls is expensive. After each `db.commit()`, SQLAlchemy releases the underlying connection back to the pool automatically; you only hold it during active queries.

---

## Pilot implementation

The reference implementation lives in:

| File | Role |
|------|------|
| `backend/repositories/jobs/job_run_repository.py` | Repository: `db: Session` first param on all methods |
| `backend/services/jobs/job_run_service.py` | Service: `__init__(self, db: Session)` |
| `backend/routers/jobs/runs.py` | Router: `Depends(get_job_run_service)` on every route |
| `backend/tasks/scheduling/job_dispatcher.py` | Celery: `SessionLocal()` in `finally` |
| `backend/tasks/periodic_tasks.py` | Celery: `SessionLocal()` in `finally` |

Integration tests: `backend/tests/jobs/test_job_run_session.py`

---

## Wave 2 candidates

Once Wave 1 is merged and validated, apply the same pattern to:
- `auth` + `credentials` service/repository pairs
- Any domain that currently relies on `BaseRepository` methods (which still call `get_db_session()`)
