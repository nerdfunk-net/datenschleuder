"""
Helper functions for device targeting and filtering.
Moved from job_tasks.py to improve code organization.
"""

import logging
from typing import Optional, List

logger = logging.getLogger(__name__)


def get_target_devices(
    template: dict, job_parameters: Optional[dict] = None
) -> Optional[List]:
    """
    Get target devices based on template's inventory source.

    Args:
        template: Job template configuration
        job_parameters: Additional job parameters

    Returns:
        List of device UUIDs, or None if all devices should be used
    """
    inventory_source = template.get("inventory_source", "all")

    if inventory_source != "all":
        logger.warning(
            "Unsupported inventory_source '%s'; returning all devices", inventory_source
        )

    return None
