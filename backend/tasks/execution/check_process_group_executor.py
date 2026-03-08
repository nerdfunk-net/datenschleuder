"""
NiFi check-process-group job executor.
Checks whether a NiFi process group's component counters match the expected status.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_check_process_group(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Execute a check_process_group job against a single NiFi instance.

    Retrieves the ``ProcessGroupEntity`` via the nipyapi canvas API and evaluates
    the component counters (``running_count``, ``stopped_count``, ``disabled_count``,
    ``stale_count``) against the configured *expected_status*.

    When ``check_progress_group_check_children`` is ``True`` each direct child
    process group is evaluated individually in addition to the parent, and the
    overall result is ``False`` if any child fails.

    Args:
        schedule_id:    Job schedule ID (informational).
        credential_id:  Not used for this job type.
        job_parameters: Runtime overrides; recognised keys:
                        ``nifi_instance_id``, ``process_group_id``,
                        ``process_group_path``, ``check_children``,
                        ``expected_status``.
        target_devices: Not used for this job type.
        task_context:   Celery task context (used for progress updates).
        template:       Resolved job template dict (keys use the
                        ``check_progress_group_*`` prefix).
        job_run_id:     Job run ID for result tracking (informational).

    Returns:
        dict with keys ``success``, ``passed``, ``process_group_id``,
        ``process_group_name``, ``expected_status``, ``counters``,
        ``violations``, ``children`` (when *check_children* is True),
        and ``instance_id``.
    """
    from services.nifi.nifi_context import nifi_connection_scope
    from services.nifi.operations.process_groups import (
        get_process_group_status_canvas,
        evaluate_process_group_status,
        list_child_process_groups,
    )
    from repositories.nifi.nifi_cluster_repository import NifiClusterRepository

    params = job_parameters or {}
    tmpl = template or {}

    # -------------------------------------------------------------------------
    # Resolve parameters (runtime > template)
    # -------------------------------------------------------------------------
    cluster_id: Optional[int] = params.get("nifi_cluster_id") or tmpl.get(
        "check_progress_group_nifi_cluster_id"
    )
    pg_id: Optional[str] = params.get("process_group_id") or tmpl.get(
        "check_progress_group_process_group_id"
    )
    pg_path: Optional[str] = params.get("process_group_path") or tmpl.get(
        "check_progress_group_process_group_path"
    )
    check_children: bool = bool(
        params.get("check_children")
        if params.get("check_children") is not None
        else tmpl.get("check_progress_group_check_children", True)
    )
    expected_status: str = (
        params.get("expected_status")
        or tmpl.get("check_progress_group_expected_status")
        or "Running"
    )

    if not cluster_id:
        return {
            "success": False,
            "error": "No NiFi cluster ID configured for this job.",
        }
    if not pg_id:
        return {
            "success": False,
            "error": "No process group ID configured for this job.",
        }

    # -------------------------------------------------------------------------
    # Resolve cluster → primary instance
    # -------------------------------------------------------------------------
    task_context.update_state(
        state="PROGRESS",
        meta={"current": 10, "total": 100, "status": "Resolving NiFi cluster primary instance…"},
    )

    cluster_repo = NifiClusterRepository()
    instance = cluster_repo.get_primary_instance(int(cluster_id))
    if not instance:
        return {
            "success": False,
            "error": "No primary instance configured for NiFi cluster %d." % cluster_id,
        }

    # nifi_connection_scope handles save/configure/restore around all nipyapi calls.
    # Celery tasks run one-per-worker-process so no asyncio lock is needed.
    with nifi_connection_scope(instance):
        # -------------------------------------------------------------------------
        # Fetch and evaluate the target process group
        # -------------------------------------------------------------------------
        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 30,
                "total": 100,
                "status": "Fetching status for process group '%s'…" % (pg_path or pg_id),
            },
        )

        try:
            pg_status = get_process_group_status_canvas(pg_id)
        except Exception as exc:
            logger.error(
                "check_process_group: failed to fetch status for pg '%s': %s",
                pg_id,
                exc,
                exc_info=True,
            )
            return {
                "success": False,
                "error": "Failed to fetch process group status: %s" % str(exc),
                "cluster_id": cluster_id,
                "instance_id": instance.id,
                "process_group_id": pg_id,
            }

        evaluation = evaluate_process_group_status(pg_status, expected_status)
        overall_passed: bool = evaluation["passed"]

        # -------------------------------------------------------------------------
        # Optionally check child process groups individually
        # -------------------------------------------------------------------------
        children_results: list = []

        if check_children:
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": 60,
                    "total": 100,
                    "status": "Checking child process groups…",
                },
            )
            try:
                children = list_child_process_groups(pg_id)
            except Exception as exc:
                logger.warning(
                    "check_process_group: could not list children for pg '%s': %s",
                    pg_id,
                    exc,
                )
                children = []

            for child in children:
                child_id: str = child.get("id", "")
                child_name: str = child.get("name", child_id)
                try:
                    child_status = get_process_group_status_canvas(child_id)
                    child_eval = evaluate_process_group_status(child_status, expected_status)
                    if not child_eval["passed"]:
                        overall_passed = False
                    children_results.append(
                        {
                            "id": child_id,
                            "name": child_name,
                            "passed": child_eval["passed"],
                            "counters": child_eval["counters"],
                            "violations": child_eval["violations"],
                        }
                    )
                except Exception as exc:
                    logger.warning(
                        "check_process_group: failed to check child '%s': %s",
                        child_name,
                        exc,
                    )
                    overall_passed = False
                    children_results.append(
                        {
                            "id": child_id,
                            "name": child_name,
                            "passed": False,
                            "error": str(exc),
                        }
                    )

        # -------------------------------------------------------------------------
        # Final result
        # -------------------------------------------------------------------------
        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": 100,
                "total": 100,
                "status": "Done – check %s" % ("passed" if overall_passed else "FAILED"),
            },
        )

        logger.info(
            "check_process_group: cluster=%d instance=%d pg=%s expected=%s passed=%s",
            cluster_id,
            instance.id,
            pg_id,
            expected_status,
            overall_passed,
        )

        result: Dict[str, Any] = {
            "success": True,
            "passed": overall_passed,
            "cluster_id": cluster_id,
            "instance_id": instance.id,
            "instance_name": instance.name or str(instance.id),
            "process_group_id": pg_id,
            "process_group_name": pg_status.get("name"),
            "process_group_path": pg_path,
            "expected_status": expected_status,
            "check_children": check_children,
            "counters": evaluation["counters"],
            "violations": evaluation["violations"],
        }

        if check_children:
            result["children"] = children_results
            result["children_count"] = len(children_results)

        return result
