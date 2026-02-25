"""
Base executor and job type dispatcher.
Routes job execution to appropriate executor based on job type.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_job_type(
    job_type: str,
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute the appropriate job based on job type.

    Routes the job execution to the correct executor function.

    Args:
        job_type: Type of job to execute
        schedule_id: ID of schedule if triggered by schedule
        credential_id: ID of credential for authentication
        job_parameters: Additional job parameters
        target_devices: List of target device UUIDs
        task_context: Celery task context (self)
        template: Job template configuration
        job_run_id: Job run ID for result tracking

    Returns:
        dict: Execution results
    """
    from .check_queues_executor import execute_check_queues
    from .check_process_group_executor import execute_check_process_group
    from .run_commands_executor import execute_run_commands
    from .backup_executor import execute_backup

    def _stub_sync_devices(schedule_id, credential_id, job_parameters,
                           target_devices, task_context, template=None, job_run_id=None):
        logger.warning("execute_job_type: sync_devices is not available (CheckMK removed)")
        return {"success": False, "error": "CheckMK sync service is not available in this version"}

    def _stub_compare_devices(schedule_id, credential_id, job_parameters,
                              target_devices, task_context, template=None, job_run_id=None):
        logger.warning("execute_job_type: compare_devices is not available (CheckMK removed)")
        return {"success": False, "error": "CheckMK comparison service is not available in this version"}

    job_executors = {
        "check_queues": execute_check_queues,
        "check_progress_group": execute_check_process_group,
        "run_commands": execute_run_commands,
        "backup": execute_backup,
        "sync_devices": _stub_sync_devices,
        "compare_devices": _stub_compare_devices,
    }

    executor = job_executors.get(job_type)
    if not executor:
        return {"success": False, "error": f"Unknown job type: {job_type}"}

    return executor(
        schedule_id=schedule_id,
        credential_id=credential_id,
        job_parameters=job_parameters,
        target_devices=target_devices,
        task_context=task_context,
        template=template,
        job_run_id=job_run_id,
    )
