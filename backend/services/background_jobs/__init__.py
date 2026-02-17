"""
Background jobs package for Celery tasks.

This package contains simple placeholder Celery tasks for demonstration.
"""

from services.background_jobs.cache_demo_jobs import cache_demo_task

__all__ = [
    "cache_demo_task",
]
