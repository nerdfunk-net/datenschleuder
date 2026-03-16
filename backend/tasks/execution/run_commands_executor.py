"""
Run commands executor stub.

This executor previously used device data and SSH execution (via Netmiko),
neither of which is available in this scaffold. The job type is preserved
in the dispatcher for forward compatibility but always returns an informative error.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_run_commands(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Stub: run_commands job type is not available in this scaffold.

    This executor previously relied on external device inventory and SSH
    execution services (Netmiko) which have been removed from this codebase.

    Args:
        schedule_id: Job schedule ID
        credential_id: ID of credential for device authentication
        job_parameters: Additional job parameters (contains command_template_name)
        target_devices: List of device UUIDs to run commands on
        task_context: Celery task context for progress updates
        template: Job template configuration
        job_run_id: Job run ID for result tracking

    Returns:
        dict: Error result indicating the job type is unavailable
    """
    logger.warning(
        "execute_run_commands: job type 'run_commands' is not available in this scaffold"
    )
    return {
        "success": False,
        "error": "The 'run_commands' job type is not available in this scaffold.",
    }
