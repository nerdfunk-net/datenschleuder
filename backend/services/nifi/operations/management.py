"""Shared NiFi operations management service.

This module provides reusable helpers for retrieving and evaluating NiFi component
data.  It is used both by the HTTP router layer and by Celery background tasks so
that the core logic lives in exactly one place.

Usage
-----
The caller is responsible for configuring the nipyapi connection before calling any
function that talks to NiFi (e.g. via
``nifi_connection_service.configure_from_instance(instance)``).  The functions here
are intentionally *stateless* pure-ish helpers so that they can run inside either an
async HTTP handler or a synchronous Celery worker.
"""

import logging
import re
from typing import Any, Dict, List, Literal, Optional, Tuple

logger = logging.getLogger(__name__)

# Recognised check modes
CheckMode = Literal["count", "bytes", "both"]

# ---------------------------------------------------------------------------
# Flow-file count parsing
# ---------------------------------------------------------------------------


def parse_queued_count(queued_str: Optional[str]) -> int:
    """Return the integer flow-file count embedded in NiFi's *queued* string.

    NiFi formats queue depth as ``"1,234 (5.67 MB)"``.  This helper strips the
    byte annotation and the thousands separator so we get a plain ``int``.

    Returns 0 when *queued_str* is ``None`` or cannot be parsed.
    """
    if not queued_str:
        return 0

    match = re.match(r"^\s*([\d,]+)", queued_str)
    if match:
        return int(match.group(1).replace(",", ""))

    logger.debug("Could not parse queued count from value: %r", queued_str)
    return 0


# ---------------------------------------------------------------------------
# Queue size (bytes → MB) parsing
# ---------------------------------------------------------------------------

_UNIT_TO_MB: Dict[str, float] = {
    "bytes": 1 / (1024 * 1024),
    "b": 1 / (1024 * 1024),
    "kb": 1 / 1024,
    "mb": 1.0,
    "gb": 1024.0,
    "tb": 1024.0 * 1024.0,
}


def parse_queued_bytes_mb(queued_str: Optional[str]) -> float:
    """Return the queue size in MB from NiFi's *queued* string.

    NiFi formats byte counts inside parentheses, e.g.:
    - ``"1,234 (5.67 MB)"``     → 5.67
    - ``"512 (1.23 KB)"``       → ~0.0012
    - ``"100,000 (1.50 GB)"``   → 1536.0
    - ``"0 (0 bytes)"``         → 0.0

    Returns 0.0 when *queued_str* is ``None`` or cannot be parsed.
    """
    if not queued_str:
        return 0.0

    match = re.search(r"\(([\d.]+)\s*([A-Za-z]+)\)", queued_str)
    if match:
        value = float(match.group(1))
        unit = match.group(2).lower()
        factor = _UNIT_TO_MB.get(unit, 1.0)
        return value * factor

    logger.debug("Could not parse queued bytes from value: %r", queued_str)
    return 0.0


# ---------------------------------------------------------------------------
# Traffic-light threshold evaluation
# ---------------------------------------------------------------------------


def evaluate_queue_status(count: int, yellow_threshold: int, red_threshold: int) -> str:
    """Map a queue depth *count* to a traffic-light status string.

    Rules (matching the spec):
    - ``count >= red_threshold``    → ``"red"``
    - ``count >= yellow_threshold`` → ``"yellow"``
    - otherwise                     → ``"green"``
    """
    if count >= red_threshold:
        return "red"
    if count >= yellow_threshold:
        return "yellow"
    return "green"


def evaluate_queue_status_float(
    value: float, yellow_threshold: float, red_threshold: float
) -> str:
    """Same as :func:`evaluate_queue_status` but for floating-point metrics (e.g. MB)."""
    if value >= red_threshold:
        return "red"
    if value >= yellow_threshold:
        return "yellow"
    return "green"


def _worst_status(a: str, b: str) -> str:
    rank = {"green": 0, "yellow": 1, "red": 2}
    return a if rank[a] >= rank[b] else b


# ---------------------------------------------------------------------------
# Connection listing
# ---------------------------------------------------------------------------


def list_connections_raw(
    pg_id: str = "root",
    descendants: bool = True,
) -> List[Any]:
    """Return the raw nipyapi connection entity list for the *currently configured* NiFi.

    The caller **must** configure the NiFi connection before calling this function
    (e.g. ``nifi_connection_service.configure_from_instance(instance)``).

    Args:
        pg_id:       Process-group ID to start from.  ``"root"`` traverses the whole
                     canvas.
        descendants: If ``True`` (default) the listing recurses into child process-
                     groups.

    Returns:
        A list of nipyapi ``ConnectionEntity`` objects (may be empty).
    """
    from nipyapi import canvas

    raw = canvas.list_all_by_kind(
        kind="connections",
        pg_id=pg_id,
        descendants=descendants,
    )
    return raw or []


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------


def serialize_connection(item: Any) -> Dict[str, Any]:
    """Serialise a nipyapi ``ConnectionEntity`` to a plain ``dict``.

    The output schema is identical to what the ``/ops/components`` router
    previously constructed inline, so downstream consumers (UI, Celery results)
    always see the same shape.
    """
    comp_data: Dict[str, Any] = {}

    if hasattr(item, "id"):
        comp_data["id"] = item.id

    comp = getattr(item, "component", None)
    if comp:
        comp_data["name"] = getattr(comp, "name", None)
        comp_data["parent_group_id"] = getattr(comp, "parent_group_id", None)
        comp_data["type"] = getattr(comp, "type", None)
        comp_data["comments"] = getattr(comp, "comments", None)

        for side in ("source", "destination"):
            node = getattr(comp, side, None)
            if node:
                comp_data[side] = {
                    "id": getattr(node, "id", None),
                    "name": getattr(node, "name", None),
                    "type": getattr(node, "type", None),
                    "group_id": getattr(node, "group_id", None),
                }

    item_status = getattr(item, "status", None)
    if item_status:
        snapshot = getattr(item_status, "aggregate_snapshot", None)
        comp_data["status"] = {
            "run_status": getattr(item_status, "run_status", None),
            "aggregate_snapshot": (
                {
                    "active_thread_count": getattr(snapshot, "active_thread_count", None),
                    "bytes_in": getattr(snapshot, "bytes_in", None),
                    "bytes_out": getattr(snapshot, "bytes_out", None),
                    "flow_files_in": getattr(snapshot, "flow_files_in", None),
                    "flow_files_out": getattr(snapshot, "flow_files_out", None),
                    "queued": getattr(snapshot, "queued", None),
                }
                if snapshot
                else {}
            ),
        }

    return comp_data


def serialize_component_by_kind(item: Any, kind: str) -> Dict[str, Any]:
    """Serialise any nipyapi component entity to a plain ``dict``.

    For ``kind='connections'`` the source/destination endpoints are included;
    for all other kinds only the generic fields are populated.  Queue-check
    fields are **not** added here – use :func:`check_connection_queues` for that.
    """
    comp_data: Dict[str, Any] = {}

    if hasattr(item, "id"):
        comp_data["id"] = item.id

    comp = getattr(item, "component", None)
    if comp:
        comp_data["name"] = getattr(comp, "name", None)
        comp_data["parent_group_id"] = getattr(comp, "parent_group_id", None)
        comp_data["type"] = getattr(comp, "type", None)
        comp_data["comments"] = getattr(comp, "comments", None)

        if kind in ("connections", "connection"):
            for side in ("source", "destination"):
                node = getattr(comp, side, None)
                if node:
                    comp_data[side] = {
                        "id": getattr(node, "id", None),
                        "name": getattr(node, "name", None),
                        "type": getattr(node, "type", None),
                        "group_id": getattr(node, "group_id", None),
                    }

    item_status = getattr(item, "status", None)
    if item_status:
        snapshot = getattr(item_status, "aggregate_snapshot", None)
        comp_data["status"] = {
            "run_status": getattr(item_status, "run_status", None),
            "aggregate_snapshot": (
                {
                    "active_thread_count": getattr(snapshot, "active_thread_count", None),
                    "bytes_in": getattr(snapshot, "bytes_in", None),
                    "bytes_out": getattr(snapshot, "bytes_out", None),
                    "flow_files_in": getattr(snapshot, "flow_files_in", None),
                    "flow_files_out": getattr(snapshot, "flow_files_out", None),
                    "queued": getattr(snapshot, "queued", None),
                }
                if snapshot
                else {}
            ),
        }

    return comp_data


# ---------------------------------------------------------------------------
# Queue-check evaluation
# ---------------------------------------------------------------------------


def check_connection_queues(
    connections: List[Any],
    mode: str,
    count_yellow: int,
    count_red: int,
    bytes_yellow_mb: int,
    bytes_red_mb: int,
) -> Tuple[List[Dict[str, Any]], str]:
    """Evaluate queue depth for every connection and compute an overall status.

    For each connection the serialised dict is extended with a ``queue_check``
    sub-key::

        {
            "mode":             "count" | "bytes" | "both",
            "count": {
                "queued_count":     <int>,
                "yellow_threshold": <int>,
                "red_threshold":    <int>,
                "status":           <str>,
            },
            "bytes": {
                "queued_mb":        <float>,
                "yellow_threshold_mb": <int>,
                "red_threshold_mb":    <int>,
                "status":           <str>,
            },
            "status":           "green" | "yellow" | "red",  # worst across active modes
        }

    The *overall* status is the worst status across all connections and all
    active modes (red > yellow > green).

    Args:
        connections:    Raw nipyapi connection entity list (output of
                        :func:`list_connections_raw`).
        mode:           ``'count'``, ``'bytes'``, or ``'both'``.
        count_yellow:   Flow-file count threshold for yellow.
        count_red:      Flow-file count threshold for red.
        bytes_yellow_mb: Queue size (MB) threshold for yellow.
        bytes_red_mb:    Queue size (MB) threshold for red.

    Returns:
        A ``(results, overall_status)`` tuple where *results* is the list of
        enriched connection dicts and *overall_status* is the worst status seen.
    """
    results: List[Dict[str, Any]] = []
    overall_status = "green"

    check_count = mode in ("count", "both")
    check_bytes = mode in ("bytes", "both")

    for item in connections:
        data = serialize_connection(item)
        snapshot = (data.get("status") or {}).get("aggregate_snapshot", {})
        queued_str: Optional[str] = snapshot.get("queued")

        count_info: Dict[str, Any] = {}
        bytes_info: Dict[str, Any] = {}
        conn_status = "green"

        if check_count:
            queued_count = parse_queued_count(queued_str)
            count_status = evaluate_queue_status(queued_count, count_yellow, count_red)
            count_info = {
                "queued_count": queued_count,
                "yellow_threshold": count_yellow,
                "red_threshold": count_red,
                "status": count_status,
            }
            conn_status = _worst_status(conn_status, count_status)

        if check_bytes:
            queued_mb = parse_queued_bytes_mb(queued_str)
            bytes_status = evaluate_queue_status_float(
                queued_mb, bytes_yellow_mb, bytes_red_mb
            )
            bytes_info = {
                "queued_mb": round(queued_mb, 3),
                "yellow_threshold_mb": bytes_yellow_mb,
                "red_threshold_mb": bytes_red_mb,
                "status": bytes_status,
            }
            conn_status = _worst_status(conn_status, bytes_status)

        data["queue_check"] = {
            "mode": mode,
            "count": count_info,
            "bytes": bytes_info,
            "status": conn_status,
        }

        overall_status = _worst_status(overall_status, conn_status)
        results.append(data)

    return results, overall_status

