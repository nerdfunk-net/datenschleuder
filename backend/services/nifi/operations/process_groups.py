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
    if hasattr(pg, "component") and hasattr(pg.component, "version_control_information"):
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

            if hasattr(pg, "component") and hasattr(pg.component, "version_control_information"):
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
            ports.append({
                "id": port.id,
                "name": port.component.name if hasattr(port, "component") else "Unknown",
                "state": port.component.state if hasattr(port, "component") else "UNKNOWN",
                "comments": getattr(port.component, "comments", None) if hasattr(port, "component") else None,
            })

    return ports


def get_input_ports(pg_id: str) -> List[Dict[str, Any]]:
    """Get input ports of a process group."""
    pg_api = ProcessGroupsApi()
    response = pg_api.get_input_ports(id=pg_id)

    ports = []
    if hasattr(response, "input_ports") and response.input_ports:
        for port in response.input_ports:
            ports.append({
                "id": port.id,
                "name": port.component.name if hasattr(port, "component") else "Unknown",
                "state": port.component.state if hasattr(port, "component") else "UNKNOWN",
                "comments": getattr(port.component, "comments", None) if hasattr(port, "component") else None,
                "concurrent_tasks": getattr(port.component, "concurrently_schedulable_task_count", None) if hasattr(port, "component") else None,
            })

    return ports


def list_processors(pg_id: str) -> List[Dict[str, Any]]:
    """List all processors in a process group."""
    processors = canvas.list_all_processors(pg_id=pg_id)

    result = []
    for proc in processors:
        comp = proc.component if hasattr(proc, "component") else None
        result.append({
            "id": proc.id,
            "name": comp.name if comp else "Unknown",
            "type": comp.type if comp else "Unknown",
            "state": comp.state if comp else "UNKNOWN",
            "parent_group_id": comp.parent_group_id if comp else None,
            "comments": getattr(comp, "comments", None) if comp else None,
        })

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
        "source_name": source.component.name if hasattr(source, "component") else "Unknown",
        "target_id": target_id,
        "target_name": target.component.name if hasattr(target, "component") else "Unknown",
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

    if not hasattr(pg, "component") or not hasattr(pg.component, "version_control_information"):
        return False

    if not pg.component.version_control_information:
        return False

    versioning.stop_flow_ver(pg, refresh=True)
    return True
