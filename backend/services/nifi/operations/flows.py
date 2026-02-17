"""NiFi flow export/import operations - pure nipyapi logic."""

import logging
from typing import Optional, Dict, Any

from nipyapi import versioning
from nipyapi.nifi import FlowApi

logger = logging.getLogger(__name__)


def export_flow(
    registry_id: str,
    bucket_id: str,
    flow_id: str,
    version: Optional[str] = None,
    mode: str = "json",
) -> Dict[str, Any]:
    """Export a flow from registry."""
    if mode not in ("json", "yaml"):
        raise ValueError("Mode must be 'json' or 'yaml'")

    # Verify registry exists and check type
    registry_clients = versioning.list_registry_clients()
    registry_found = False
    registry_type = None

    if hasattr(registry_clients, "registries") and registry_clients.registries:
        for client in registry_clients.registries:
            if client.id == registry_id:
                registry_found = True
                if hasattr(client, "component") and hasattr(client.component, "type"):
                    registry_type = client.component.type
                break

    if not registry_found:
        raise ValueError("Registry client with id '%s' not found" % registry_id)

    is_external = registry_type and (
        "github" in registry_type.lower() or "git" in registry_type.lower()
    )
    if is_external:
        raise ValueError(
            "Export is not supported for %s registries" % registry_type
        )

    exported_content = versioning.export_flow_version(
        bucket_id=bucket_id, flow_id=flow_id, version=version, mode=mode
    )

    flow_name = flow_id
    try:
        flow = versioning.get_flow_in_bucket(bucket_id, identifier=flow_id)
        if hasattr(flow, "name"):
            flow_name = flow.name
    except Exception:
        pass

    version_suffix = "_v%s" % version if version else "_latest"
    filename = "%s%s.%s" % (flow_name, version_suffix, mode)

    return {
        "content": exported_content,
        "filename": filename,
        "content_type": "application/json" if mode == "json" else "application/x-yaml",
    }


def import_flow(
    registry_id: str,
    bucket_id: str,
    encoded_flow: str,
    flow_name: Optional[str] = None,
    flow_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Import a flow to registry."""
    # Verify registry exists and check type
    registry_clients = versioning.list_registry_clients()
    registry_found = False
    registry_type = None

    if hasattr(registry_clients, "registries") and registry_clients.registries:
        for client in registry_clients.registries:
            if client.id == registry_id:
                registry_found = True
                if hasattr(client, "component") and hasattr(client.component, "type"):
                    registry_type = client.component.type
                break

    if not registry_found:
        raise ValueError("Registry client with id '%s' not found" % registry_id)

    is_external = registry_type and (
        "github" in registry_type.lower() or "git" in registry_type.lower()
    )
    if is_external:
        raise ValueError(
            "Import is not supported for %s registries" % registry_type
        )

    imported_flow = versioning.import_flow_version(
        bucket_id=bucket_id,
        encoded_flow=encoded_flow,
        flow_name=flow_name,
        flow_id=flow_id,
    )

    result_flow_name = flow_name
    result_flow_id = flow_id
    result_version = "unknown"

    if hasattr(imported_flow, "snapshot_metadata"):
        metadata = imported_flow.snapshot_metadata
        if hasattr(metadata, "flow_identifier"):
            result_flow_id = metadata.flow_identifier
        if hasattr(metadata, "version"):
            result_version = str(metadata.version)

    if hasattr(imported_flow, "flow"):
        if hasattr(imported_flow.flow, "identifier"):
            result_flow_id = imported_flow.flow.identifier
        if hasattr(imported_flow.flow, "name"):
            result_flow_name = imported_flow.flow.name

    return {
        "flow_name": result_flow_name or "Unknown",
        "flow_id": result_flow_id or "Unknown",
        "version": result_version,
    }
