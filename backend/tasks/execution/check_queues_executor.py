"""
NiFi queue-check job executor.
Evaluates queue depths across NiFi connections against configurable thresholds.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_check_queues(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Execute a check_queues job against one or more NiFi instances.

    Retrieves all connections from each targeted NiFi instance and compares their
    queue depths against configurable thresholds supplied via *job_parameters*
    (or the resolved *template*).

    Args:
        schedule_id:    Job schedule ID (informational).
        credential_id:  Not used for NiFi queue checks.
        job_parameters: Runtime overrides; recognised keys:
                        ``check_queues_mode``, ``check_queues_count_yellow``,
                        ``check_queues_count_red``, ``check_queues_bytes_yellow``,
                        ``check_queues_bytes_red``, ``nifi_cluster_ids``.
        target_devices: Not used for NiFi queue checks.
        task_context:   Celery task context (used for progress updates).
        template:       Resolved job template dict.
        job_run_id:     Job run ID for result tracking (informational).

    Returns:
        dict with keys ``success``, ``instances``, ``overall_status``,
        ``summary``, and ``thresholds``.
    """
    from services.nifi.nifi_context import nifi_connection_scope
    from services.nifi.operations import management as mgmt_ops
    from repositories.nifi.nifi_cluster_repository import NifiClusterRepository

    params = job_parameters or {}
    tmpl = template or {}

    mode: str = (
        params.get("check_queues_mode") or tmpl.get("check_queues_mode") or "count"
    )
    count_yellow: int = int(
        params.get("check_queues_count_yellow")
        or tmpl.get("check_queues_count_yellow")
        or 1_000
    )
    count_red: int = int(
        params.get("check_queues_count_red")
        or tmpl.get("check_queues_count_red")
        or 10_000
    )
    bytes_yellow_mb: int = int(
        params.get("check_queues_bytes_yellow")
        or tmpl.get("check_queues_bytes_yellow")
        or 10
    )
    bytes_red_mb: int = int(
        params.get("check_queues_bytes_red")
        or tmpl.get("check_queues_bytes_red")
        or 100
    )

    # Resolve which NiFi instances to check via cluster → primary instance resolution
    cluster_repo = NifiClusterRepository()
    cluster_ids = params.get("nifi_cluster_ids") or (
        tmpl.get("nifi_cluster_ids") if tmpl else None
    )

    task_context.update_state(
        state="PROGRESS",
        meta={"current": 0, "total": 100, "status": "Resolving NiFi clusters…"},
    )

    if cluster_ids:
        instances = [cluster_repo.get_primary_instance(cid) for cid in cluster_ids]
        instances = [i for i in instances if i is not None]
        logger.info(
            "check_queues: checking %d specified NiFi cluster(s) via primary instance(s)",
            len(instances),
        )
    else:
        all_clusters = cluster_repo.get_all_with_members()
        instances = [cluster_repo.get_primary_instance(c.id) for c in all_clusters]
        instances = [i for i in instances if i is not None]
        logger.info(
            "check_queues: checking all %d NiFi cluster(s) via primary instance(s)",
            len(instances),
        )

    if not instances:
        return {
            "success": True,
            "message": "No NiFi instances found to check",
            "instances": [],
            "overall_status": "green",
            "summary": {"green": 0, "yellow": 0, "red": 0},
        }

    STATUS_RANK = {"green": 0, "yellow": 1, "red": 2}
    rank_to_status = {v: k for k, v in STATUS_RANK.items()}

    instance_results = []
    overall_rank = 0
    summary: Dict[str, int] = {"green": 0, "yellow": 0, "red": 0}
    total = len(instances)

    for idx, instance in enumerate(instances):
        instance_id: int = instance.id
        instance_name: str = instance.name or str(instance_id)

        progress_pct = int((idx / total) * 90)
        task_context.update_state(
            state="PROGRESS",
            meta={
                "current": progress_pct,
                "total": 100,
                "status": "Checking instance '%s' (%d/%d)…"
                % (instance_name, idx + 1, total),
            },
        )

        try:
            with nifi_connection_scope(instance):
                raw_connections = mgmt_ops.list_connections_raw()
                connections, inst_status = mgmt_ops.check_connection_queues(
                    raw_connections,
                    mode=mode,
                    count_yellow=count_yellow,
                    count_red=count_red,
                    bytes_yellow_mb=bytes_yellow_mb,
                    bytes_red_mb=bytes_red_mb,
                )
            logger.info(
                "check_queues: instance '%s' → %d connection(s), overall=%s",
                instance_name,
                len(connections),
                inst_status,
            )
        except Exception as exc:
            logger.error(
                "check_queues: failed to check instance '%s': %s",
                instance_name,
                exc,
                exc_info=True,
            )
            instance_results.append(
                {
                    "instance_id": instance_id,
                    "instance_name": instance_name,
                    "overall_status": "red",
                    "error": str(exc),
                    "connections": [],
                    "connection_count": 0,
                }
            )
            overall_rank = max(overall_rank, STATUS_RANK["red"])
            summary["red"] += 1
            continue

        overall_rank = max(overall_rank, STATUS_RANK[inst_status])
        summary[inst_status] += 1

        instance_results.append(
            {
                "instance_id": instance_id,
                "instance_name": instance_name,
                "overall_status": inst_status,
                "connections": connections,
                "connection_count": len(connections),
            }
        )

    overall_status = rank_to_status[overall_rank]

    task_context.update_state(
        state="PROGRESS",
        meta={
            "current": 100,
            "total": 100,
            "status": "Done – overall status: %s" % overall_status,
        },
    )

    return {
        "success": True,
        "instances": instance_results,
        "overall_status": overall_status,
        "summary": summary,
        "thresholds": {
            "mode": mode,
            "count_yellow": count_yellow,
            "count_red": count_red,
            "bytes_yellow_mb": bytes_yellow_mb,
            "bytes_red_mb": bytes_red_mb,
        },
    }
