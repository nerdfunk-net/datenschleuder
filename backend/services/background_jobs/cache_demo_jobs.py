"""
Simple cache demo Celery task.
Placeholder for demonstrating where caching functionality would go.
"""

import time
import logging
from typing import Dict, Any
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="cache_demo_task")
def cache_demo_task(self) -> Dict[str, Any]:
    """
    Demo cache task - shows where your caching logic would go.
    
    This is a placeholder task that demonstrates:
    1. Connecting to cache service (Redis)
    2. Storing sample data
    3. Reporting progress
    4. Returning results
    
    Returns:
        Dictionary with task results
    """
    try:
        logger.info(f"Starting cache demo task: {self.request.id}")
        
        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={"status": "Initializing cache demo..."}
        )
        
        # Import cache service
        from services.settings.cache import cache_service
        
        # Simulate some work
        time.sleep(1)
        
        self.update_state(
            state="PROGRESS",
            meta={"status": "Storing demo data in cache..."}
        )
        
        # Store some demo data in cache
        demo_data = {
            "message": "This could be your caching!",
            "timestamp": time.time(),
            "task_id": self.request.id,
            "example": "Replace this with your actual caching logic"
        }
        
        cache_key = "demo:cache:example"
        cache_service.set(cache_key, demo_data, 300)  # 5 minutes TTL
        
        # Simulate more work
        time.sleep(1)
        
        self.update_state(
            state="PROGRESS",
            meta={"status": "Verifying cached data..."}
        )
        
        # Verify it was cached
        cached = cache_service.get(cache_key)
        
        logger.info(
            f"Cache demo task {self.request.id} completed. "
            f"Cached: {cached is not None}"
        )
        
        return {
            "status": "success",
            "message": "Cache demo completed successfully!",
            "cached_key": cache_key,
            "data_cached": cached is not None,
            "task_id": self.request.id,
        }
        
    except Exception as e:
        logger.error(f"Cache demo task failed: {e}", exc_info=True)
        return {
            "status": "error",
            "message": f"Cache demo failed: {str(e)}"
        }
