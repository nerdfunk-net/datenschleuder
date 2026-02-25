"""NiFi process group operations - pure nipyapi logic."""

import logging
from typing import Dict, Any, Optional, List

from nipyapi import canvas, versioning
from nipyapi.nifi import ProcessGroupsApi

logger = logging.getLogger(__name__)


def get_process_group(
    identifier: str = None,
    name: str = None,
    greedy: bool = True,
) -> Dict[str, Any]:
    """Get a process group by ID or name."""
    if identifier:
        pg = canvas.get_process_group(identifier, "id")
    elif name:
        pg = canvas.get_process_group(name, "name", greedy=greedy)
    else:
        raise ValueError("Either 'id' or 'name' must be provided")

    if not pg:
        raise ValueError("Process group not found")

    result = {
        "id": pg.id if hasattr(pg, "id") else None,
        "name": None,
        "parent_group_id": None,
        "comments": None,
    }

    if hasattr(pg, "component"):
        result["name"] = getattr(pg.component, "name", None)
        result["parent_group_id"] = getattr(pg.component, "parent_group_id", None)
        result["comments"] = getattr(pg.component, "comments", None)

    # Add status info
    if hasattr(pg, "status"):
        result["running_count"] = getattr(pg, "running_count", 0)
        result["stopped_count"] = getattr(pg, "stopped_count", 0)
        result["disabled_count"] = getattr(pg, "disabled_count", 0)

    # Add version control info
    if hasattr(pg, "component") and hasattr(
        pg.component, "version_control_information"
    ):
        vci = pg.component.version_control_information
        if vci:
            result["version_control"] = {
                "version": getattr(vci, "version", None),
                "state": getattr(vci, "state", None),
                "state_explanation": getattr(vci, "state_explanation", None),
            }

    return result


def list_child_process_groups(parent_pg_id: str) -> List[Dict[str, Any]]:
    """List direct child process groups."""
    pg_api = ProcessGroupsApi()
    response = pg_api.get_process_groups(id=parent_pg_id)

    result = []
    if hasattr(response, "process_groups"):
        for pg in response.process_groups:
            pg_data = {
                "id": pg.id,
                "name": pg.component.name if hasattr(pg, "component") else "Unknown",
                "running_count": getattr(pg, "running_count", 0),
                "stopped_count": getattr(pg, "stopped_count", 0),
                "disabled_count": getattr(pg, "disabled_count", 0),
            }

            if hasattr(pg, "component") and hasattr(
                pg.component, "version_control_information"
            ):
                vci = pg.component.version_control_information
                if vci:
                    pg_data["version_control"] = {
                        "version": getattr(vci, "version", None),
                        "state": getattr(vci, "state", None),
                    }

            result.append(pg_data)

    return result


def get_output_ports(pg_id: str) -> List[Dict[str, Any]]:
    """Get output ports of a process group."""
    pg_api = ProcessGroupsApi()
    response = pg_api.get_output_ports(id=pg_id)

    ports = []
    if hasattr(response, "output_ports") and response.output_ports:
        for port in response.output_ports:
            ports.append(
                {
                    "id": port.id,
                    "name": port.component.name
                    if hasattr(port, "component")
                    else "Unknown",
                    "state": port.component.state
                    if hasattr(port, "component")
                    else "UNKNOWN",
                    "comments": getattr(port.component, "comments", None)
                    if hasattr(port, "component")
                    else None,
                }
            )

    return ports


def get_input_ports(pg_id: str) -> List[Dict[str, Any]]:
    """Get input ports of a process group."""
    pg_api = ProcessGroupsApi()
    response = pg_api.get_input_ports(id=pg_id)

    ports = []
    if hasattr(response, "input_ports") and response.input_ports:
        for port in response.input_ports:
            ports.append(
                {
                    "id": port.id,
                    "name": port.component.name
                    if hasattr(port, "component")
                    else "Unknown",
                    "state": port.component.state
                    if hasattr(port, "component")
                    else "UNKNOWN",
                    "comments": getattr(port.component, "comments", None)
                    if hasattr(port, "component")
                    else None,
                    "concurrent_tasks": getattr(
                        port.component, "concurrently_schedulable_task_count", None
                    )
                    if hasattr(port, "component")
                    else None,
                }
            )

    return ports


def list_processors(pg_id: str) -> List[Dict[str, Any]]:
    """List all processors in a process group."""
    processors = canvas.list_all_processors(pg_id=pg_id)

    result = []
    for proc in processors:
        comp = proc.component if hasattr(proc, "component") else None
        result.append(
            {
                "id": proc.id,
                "name": comp.name if comp else "Unknown",
                "type": comp.type if comp else "Unknown",
                "state": comp.state if comp else "UNKNOWN",
                "parent_group_id": comp.parent_group_id if comp else None,
                "comments": getattr(comp, "comments", None) if comp else None,
            }
        )

    return result


def get_process_group_configuration(
    process_group_id: str, identifier_type: str = "id"
) -> Dict[str, Any]:
    """Get full process group configuration."""
    pg = canvas.get_process_group(
        identifier=process_group_id, identifier_type=identifier_type, greedy=True
    )

    if not pg:
        raise ValueError("Process group '%s' not found" % process_group_id)

    if hasattr(pg, "to_dict"):
        return pg.to_dict()

    return pg


def update_process_group_configuration(
    process_group_id: str,
    update: dict,
    identifier_type: str = "id",
    refresh: bool = True,
) -> Dict[str, Any]:
    """Update process group configuration."""
    pg = canvas.get_process_group(
        identifier=process_group_id, identifier_type=identifier_type, greedy=True
    )

    if not pg:
        raise ValueError("Process group '%s' not found" % process_group_id)

    updated_pg = canvas.update_process_group(pg=pg, update=update, refresh=refresh)

    if hasattr(updated_pg, "to_dict"):
        return updated_pg.to_dict()

    return updated_pg


def create_connection(
    source_id: str,
    target_id: str,
    parent_pg_id: str,
    name: Optional[str] = None,
    relationships: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Create a connection between two components."""
    source = canvas.get_processor(source_id, "id")
    target = canvas.get_processor(target_id, "id")

    kwargs = {"source": source, "target": target}
    if name:
        kwargs["name"] = name
    if relationships:
        kwargs["relationships"] = relationships

    created_conn = canvas.create_connection(**kwargs)

    return {
        "connection_id": created_conn.id,
        "source_id": source_id,
        "source_name": source.component.name
        if hasattr(source, "component")
        else "Unknown",
        "target_id": target_id,
        "target_name": target.component.name
        if hasattr(target, "component")
        else "Unknown",
    }


def assign_parameter_context(
    process_group_id: str,
    parameter_context_id: str,
    cascade: bool = False,
) -> None:
    """Assign a parameter context to a process group."""
    import nipyapi

    pg = canvas.get_process_group(process_group_id, "id")
    if not pg:
        raise ValueError("Process group '%s' not found" % process_group_id)

    nipyapi.parameters.assign_context_to_process_group(
        pg=pg,
        context_id=parameter_context_id,
        cascade=cascade,
    )


def update_version(process_group_id: str, target_version: Optional[int] = None) -> None:
    """Update a version-controlled process group to a new version."""
    pg_api = ProcessGroupsApi()
    pg = pg_api.get_process_group(id=process_group_id)
    versioning.update_flow_version(process_group=pg, target_version=target_version)


def stop_versioning(process_group_id: str) -> bool:
    """Stop version control for a process group. Returns True if was versioned."""
    pg = canvas.get_process_group(process_group_id, "id")

    if not pg:
        raise ValueError("Process group '%s' not found" % process_group_id)

    if not hasattr(pg, "component") or not hasattr(
        pg.component, "version_control_information"
    ):
        return False

    if not pg.component.version_control_information:
        return False

    versioning.stop_flow_ver(pg, refresh=True)
    return True


def get_process_group_status_canvas(pg_id: str) -> Dict[str, Any]:
    """Fetch a process group entity via the canvas API and return its status counters.

    Uses ``nipyapi.canvas.get_process_group_status(pg_id, detail='all')`` which
    returns a ``ProcessGroupEntity``.  The relevant counter fields are extracted
    from the ``component`` sub-object:

    - ``running_count``
    - ``stopped_count``
    - ``disabled_count``
    - ``stale_count``

    Args:
        pg_id: UUID of the process group to inspect.

    Returns:
        dict with keys ``id``, ``name``, ``running_count``, ``stopped_count``,
        ``disabled_count``, ``stale_count``, and the full ``raw`` entity as a dict.

    Raises:
        ValueError: If the process group is not found.
    """
    import nipyapi

    pg_entity = nipyapi.canvas.get_process_group_status(pg_id=pg_id, detail="all")

    if not pg_entity:
        raise ValueError("Process group '%s' not found" % pg_id)

    comp = getattr(pg_entity, "component", None)

    raw = pg_entity.to_dict() if hasattr(pg_entity, "to_dict") else {}

    return {
        "id": pg_id,
        "name": getattr(comp, "name", None) if comp else None,
        "running_count": int(getattr(comp, "running_count", 0) or 0) if comp else 0,
        "stopped_count": int(getattr(comp, "stopped_count", 0) or 0) if comp else 0,
        "disabled_count": int(getattr(comp, "disabled_count", 0) or 0) if comp else 0,
        "stale_count": int(getattr(comp, "stale_count", 0) or 0) if comp else 0,
        "raw": raw,
    }


def evaluate_process_group_status(
    counters: Dict[str, int],
    expected_status: str,
) -> Dict[str, Any]:
    """Evaluate whether a process group's counters match the expected status.

    Logic:

    - ``"Running"``  → stale_count, stopped_count, and disabled_count must all be 0.
    - ``"Stopped"``  → running_count, stale_count, and disabled_count must all be 0.
    - ``"Disabled"`` → running_count, stale_count, and stopped_count must all be 0.
    - ``"Enabled"``  → disabled_count must be 0.

    Args:
        counters:        Dict with ``running_count``, ``stopped_count``,
                         ``disabled_count``, ``stale_count``.
        expected_status: One of ``"Running"``, ``"Stopped"``, ``"Disabled"``,
                         ``"Enabled"``.

    Returns:
        dict with keys ``passed`` (bool), ``expected_status``, ``violations``
        (list of counter names that are non-zero when they should be 0).
    """
    running = counters.get("running_count", 0)
    stopped = counters.get("stopped_count", 0)
    disabled = counters.get("disabled_count", 0)
    stale = counters.get("stale_count", 0)

    checks: Dict[str, int] = {
        "Running": {"stale_count": stale, "stopped_count": stopped, "disabled_count": disabled},
        "Stopped": {"running_count": running, "stale_count": stale, "disabled_count": disabled},
        "Disabled": {"running_count": running, "stale_count": stale, "stopped_count": stopped},
        "Enabled": {"disabled_count": disabled},
    }.get(expected_status, {})

    violations = [name for name, value in checks.items() if value > 0]

    return {
        "passed": len(violations) == 0,
        "expected_status": expected_status,
        "violations": violations,
        "counters": {
            "running_count": running,
            "stopped_count": stopped,
            "disabled_count": disabled,
            "stale_count": stale,
        },
    }


def get_all_process_group_paths(start_pg_id: str = "root") -> Dict[str, Any]:
    """Get all process groups with their full hierarchical paths.

    Returns a dict with:
    - process_groups: flat list, each entry has:
        - id: Process group UUID
        - name: Process group name
        - path: Full path string (e.g., "/Parent/Child")
        - level: Depth in hierarchy (0 for root)
        - formatted_path: Display-friendly path (e.g., "Parent → Child")
    - root_id: UUID of the root process group
    """
    root_pg_id = canvas.get_root_pg_id()
    if start_pg_id == "root":
        start_pg_id = root_pg_id

    # Fetch root PG + all descendants in as few API calls as possible
    root_pg = canvas.get_process_group(start_pg_id, "id")
    all_pgs_raw = canvas.list_all_process_groups(start_pg_id) or []

    # Build internal map: pg_id -> {id, name, parent_group_id, comments}
    pg_map: Dict[str, Dict[str, Any]] = {}

    def _add(pg_entity) -> None:
        pg_map[pg_entity.id] = {
            "id": pg_entity.id,
            "name": pg_entity.component.name,
            "parent_group_id": pg_entity.component.parent_group_id,
            "comments": getattr(pg_entity.component, "comments", "") or "",
        }

    _add(root_pg)
    for pg in all_pgs_raw:
        if pg.id != start_pg_id:
            _add(pg)

    def _build_path(pg_id: str) -> List[Dict[str, Any]]:
        """Walk parent chain to build leaf-to-root path array."""
        path: List[Dict[str, Any]] = []
        current_id: Optional[str] = pg_id
        while current_id and current_id in pg_map:
            info = pg_map[current_id]
            path.append(
                {
                    "id": info["id"],
                    "name": info["name"],
                    "parent_group_id": info["parent_group_id"],
                }
            )
            current_id = info["parent_group_id"]
        return path

    process_groups = []
    for pg_info in pg_map.values():
        path_chain = _build_path(pg_info["id"])

        # Build string path (e.g., "/Parent/Child") and formatted path (e.g., "Parent → Child")
        if len(path_chain) <= 1:
            # Root level
            path_str = "/"
            formatted_path = f"{pg_info['name']} (root)"
        else:
            # Reverse to get root-to-leaf order
            names = [p["name"] for p in reversed(path_chain)]
            # Include all names in path string (including root)
            path_str = "/" + "/".join(names) if len(names) > 0 else "/"
            formatted_path = " → ".join(names)

        process_groups.append(
            {
                "id": pg_info["id"],
                "name": pg_info["name"],
                "path": path_str,
                "level": len(path_chain) - 1,
                "formatted_path": formatted_path,
            }
        )

    return {"process_groups": process_groups, "root_id": root_pg_id}
