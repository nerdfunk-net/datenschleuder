"""Celery worker entry point.
Run with: celery -A celery_worker worker --loglevel=info
"""

# Import worker lifecycle signals (MUST be imported before starting worker)
# This ensures each worker process gets its own isolated database engine
import core.celery_signals  # noqa: F401 - Import for side effects (signal registration)
from celery_app import celery_app

# Import all tasks to register them
try:
    from tasks import *  # noqa: F403 - intentional star import for task registration
except ImportError:
    # tasks module not yet created, will be added later
    pass

if __name__ == "__main__":
    celery_app.start()
