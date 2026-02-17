#!/usr/bin/env python3
"""
Clean Job Templates - Remove all existing templates and optionally add a simple example

This script removes all job templates from the database and optionally creates
one empty/example template for the scaffold.

Usage:
    python tools/clean_job_templates.py
    python tools/clean_job_templates.py --no-example  # Don't create example template
"""

import sys
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import get_db_session
from core.models import JobTemplate, JobSchedule
from sqlalchemy import delete

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def clean_job_templates(create_example: bool = True) -> None:
    """
    Remove all job templates and optionally create an example template.
    
    Args:
        create_example: If True, create one empty example template
    """
    logger.info("Starting job templates cleanup...")
    
    with get_db_session() as db:
        try:
            # First delete all job schedules (they reference job templates)
            schedules_result = db.execute(delete(JobSchedule))
            schedules_count = schedules_result.rowcount
            logger.info(f"Deleted {schedules_count} job schedules")
            
            # Delete all job templates
            templates_result = db.execute(delete(JobTemplate))
            templates_count = templates_result.rowcount
            logger.info(f"Deleted {templates_count} job templates")
            
            # Commit deletions
            db.commit()
            logger.info("✓ All job templates and schedules removed")
            
            # Create example template if requested
            if create_example:
                example_template = JobTemplate(
                    name="Example Template",
                    job_type="run_commands",
                    description="Example job template for scaffold - customize as needed",
                    created_by="system",
                    user_id=1,  # Admin user
                    inventory_source="all",
                    parallel_tasks=1,
                    is_global=True,  # Make it visible to all users
                )
                
                db.add(example_template)
                db.commit()
                db.refresh(example_template)
                
                logger.info(f"✓ Created example template (ID: {example_template.id})")
                logger.info(f"  Name: {example_template.name}")
                logger.info(f"  Type: {example_template.job_type}")
                logger.info(f"  Description: {example_template.description}")
            
            logger.info("\n✓ Job templates cleanup completed successfully")
            
        except Exception as e:
            logger.error(f"Error cleaning job templates: {e}")
            db.rollback()
            raise


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Clean job templates database"
    )
    parser.add_argument(
        '--no-example',
        action='store_true',
        help='Do not create example template'
    )
    
    args = parser.parse_args()
    
    try:
        clean_job_templates(create_example=not args.no_example)
    except Exception as e:
        logger.error(f"Failed to clean job templates: {e}")
        sys.exit(1)
