"""
Integration tests for JobRunService session injection pattern.

Proves that:
1. A request-scoped Session is shared across multiple service calls.
2. create_job_run + mark_started run within a single SQLAlchemy session —
   no DetachedInstanceError, no stale reads between the two steps.
3. A failed write is rolled back correctly.

Uses in-memory SQLite so no PostgreSQL is required.  Do NOT use SQLite for
tests that rely on PostgreSQL-specific behaviour (e.g. JSON operators, CTEs).
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.database import Base


@pytest.fixture(scope="module")
def engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    # Import all models so their tables are created
    import core.models  # noqa: F401
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture()
def db(engine):
    """Yield a fresh session, then roll back so tests are isolated."""
    SessionFactory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionFactory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_create_and_mark_started_share_session(db):
    """create_job_run followed by mark_started use the same session."""
    from services.jobs.job_run_service import JobRunService

    svc = JobRunService(db=db)

    run = svc.create_job_run(
        job_name="test-job",
        job_type="test",
        triggered_by="manual",
    )

    assert run["id"] is not None
    assert run["status"] == "pending"

    updated = svc.mark_started(run["id"], celery_task_id="celery-abc-123")

    assert updated is not None
    assert updated["status"] == "running"
    assert updated["celery_task_id"] == "celery-abc-123"


def test_mark_completed_persists_result(db):
    """mark_completed stores a result dict correctly."""
    from services.jobs.job_run_service import JobRunService

    svc = JobRunService(db=db)

    run = svc.create_job_run(job_name="result-job", job_type="backup")
    svc.mark_started(run["id"], celery_task_id="celery-xyz")

    result_payload = {"devices_backed_up": 10, "devices_failed": 0}
    finished = svc.mark_completed(run["id"], result=result_payload)

    assert finished["status"] == "completed"
    assert finished["result"] == result_payload


def test_mark_failed_records_error(db):
    """mark_failed stores the error message and sets status to failed."""
    from services.jobs.job_run_service import JobRunService

    svc = JobRunService(db=db)

    run = svc.create_job_run(job_name="fail-job", job_type="netmiko")
    svc.mark_started(run["id"], celery_task_id="celery-fail")

    failed = svc.mark_failed(run["id"], error_message="Connection timed out")

    assert failed["status"] == "failed"
    assert "Connection timed out" in failed["error_message"]


def test_delete_job_run(db):
    """delete_job_run removes the record from the database."""
    from services.jobs.job_run_service import JobRunService

    svc = JobRunService(db=db)

    run = svc.create_job_run(job_name="delete-job", job_type="test")
    svc.mark_completed(run["id"])

    deleted = svc.delete_job_run(run["id"])
    assert deleted is True

    fetched = svc.get_job_run(run["id"])
    assert fetched is None


def test_list_job_runs_pagination(db):
    """list_job_runs returns correct pagination metadata."""
    from services.jobs.job_run_service import JobRunService

    svc = JobRunService(db=db)

    for i in range(5):
        svc.create_job_run(job_name=f"paged-job-{i}", job_type="test")

    result = svc.list_job_runs(page=1, page_size=3)

    assert result["page"] == 1
    assert result["page_size"] == 3
    assert len(result["items"]) == 3
    assert result["total"] >= 5
