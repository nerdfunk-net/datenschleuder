"""
Celery tasks package.
Tasks are organized by function:
- scheduling: Schedule checking and job dispatching
- execution: Job type executors
- utils: Helper functions
- test_tasks: Simple test tasks for verification
"""

# Import scheduling tasks
from .scheduling import check_job_schedules_task, dispatch_job

# Import test tasks
from .test_tasks import test_task, test_progress_task

# Import periodic tasks
from .periodic_tasks import (
    worker_health_check,
    load_cache_schedules_task,
    dispatch_cache_task,
    cleanup_celery_data_task,
)

__all__ = [
    # Scheduling tasks
    "check_job_schedules_task",
    "dispatch_job",
    # Test tasks (for frontend testing)
    "test_task",
    "test_progress_task",
    # Periodic tasks
    "worker_health_check",
    "load_cache_schedules_task",
    "dispatch_cache_task",
    "cleanup_celery_data_task",
]
