"""NiFi operations endpoints (registries, flows, params, PGs, processors, versions)."""

import asyncio
import logging
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import Response

from core.auth import require_permission
from models.nifi import (
    ParameterContextListResponse,
    ParameterContextCreate,
    ParameterContextUpdate,
    ProcessorConfigurationResponse,
    ProcessorConfigurationUpdate,
    ProcessorConfigurationUpdateResponse,
    AssignParameterContextRequest,
    AssignParameterContextResponse,
    ConnectionRequest,
    ConnectionResponse,
)
from services.nifi import instance_service
from services.nifi.nifi_context import with_nifi_instance
from services.nifi.operations import (
    registries as reg_ops,
    flows as flow_ops,
    parameters as param_ops,
    process_groups as pg_ops,
    processors as proc_ops,
    versions as ver_ops,
    management as mgmt_ops,
    provenance as prov_ops,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/instances", tags=["nifi-operations"])

# ---------------------------------------------------------------------------
# Retry configuration
# ---------------------------------------------------------------------------

_NIFI_MAX_RETRIES = 3
_NIFI_RETRY_DELAY = 1.0  # seconds between attempts


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_instance(instance_id: int):
    """Fetch instance from DB, raise 404 if missing."""
    instance = instance_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    return instance


async def _execute_with_retry(
    instance_id: int,
    operation: Callable[[], Any],
    *,
    normalized_url: bool = False,
) -> Any:
    """
    Configure the NiFi connection and run *operation*, retrying up to
    _NIFI_MAX_RETRIES times when a transient network / connectivity error occurs.

    nipyapi global config is isolated per-call via nifi_connection_scope so that
    concurrent requests targeting different instances do not cross-contaminate.

    Rules:
    - ValueError  → re-raised immediately (resource not found / bad input).
    - HTTPException → re-raised immediately (already a handled error).
    - Any other exception → logged and retried after _NIFI_RETRY_DELAY seconds.
    - If every attempt fails → HTTPException(503) with a descriptive message.
    """
    last_error: Exception = RuntimeError("No attempts made")
    instance = _get_instance(instance_id)

    for attempt in range(1, _NIFI_MAX_RETRIES + 1):
        try:
            return await with_nifi_instance(
                instance, operation, normalize_url=normalized_url
            )

        except (ValueError, HTTPException):
            # Logical errors – do not retry.
            raise

        except Exception as exc:
            last_error = exc
            if attempt < _NIFI_MAX_RETRIES:
                logger.warning(
                    "NiFi instance %d unreachable (attempt %d/%d): %s — retrying in %.0fs",
                    instance_id,
                    attempt,
                    _NIFI_MAX_RETRIES,
                    exc,
                    _NIFI_RETRY_DELAY,
                )
                await asyncio.sleep(_NIFI_RETRY_DELAY)
            else:
                logger.error(
                    "NiFi instance %d unreachable after %d attempts: %s",
                    instance_id,
                    _NIFI_MAX_RETRIES,
                    exc,
                )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "NiFi instance %d is unavailable after %d connection attempts. "
            "Last error: %s" % (instance_id, _NIFI_MAX_RETRIES, last_error)
        ),
    )


# ============================================================================
# Registry Operations
# ============================================================================


@router.get("/{instance_id}/ops/registries")
async def get_registry_clients(
    instance_id: int,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    clients = await _execute_with_retry(instance_id, reg_ops.list_registry_clients)
    return {"status": "success", "registry_clients": clients, "count": len(clients)}


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets")
async def get_registry_buckets(
    instance_id: int,
    registry_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    result = await _execute_with_retry(
        instance_id,
        lambda: reg_ops.get_registry_buckets(registry_id),
    )
    return {"status": "success", **result}


@router.get("/{instance_id}/ops/registries/{registry_id}/details")
async def get_registry_details(
    instance_id: int,
    registry_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: reg_ops.get_registry_details(registry_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {"status": "success", **result}


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/flows")
async def get_bucket_flows(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    result = await _execute_with_retry(
        instance_id,
        lambda: reg_ops.get_bucket_flows(registry_id, bucket_id),
    )
    return {"status": "success", **result}


@router.get(
    "/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/flows/{flow_id}/versions"
)
async def get_flow_versions(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    flow_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    result = await _execute_with_retry(
        instance_id,
        lambda: reg_ops.get_flow_versions(registry_id, bucket_id, flow_id),
    )
    return {"status": "success", **result}


# ============================================================================
# Flow Export / Import
# ============================================================================


@router.get(
    "/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/export-flow"
)
async def export_flow(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    flow_id: str,
    version: str = None,
    mode: str = "json",
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: flow_ops.export_flow(
                registry_id, bucket_id, flow_id, version, mode
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return Response(
        content=result["content"],
        media_type=result["content_type"],
        headers={"Content-Disposition": "attachment; filename=%s" % result["filename"]},
    )


@router.post(
    "/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/import-flow"
)
async def import_flow(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    file: UploadFile = File(...),
    flow_name: str = Form(None),
    flow_id: str = Form(None),
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    if not flow_name and not flow_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either flow_name or flow_id must be provided",
        )

    # Read file content before the retry loop — UploadFile can only be read once.
    file_content = await file.read()
    encoded_flow = file_content.decode("utf-8")
    filename = file.filename

    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: flow_ops.import_flow(
                registry_id, bucket_id, encoded_flow, flow_name, flow_id
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {
        "status": "success",
        "message": "Flow imported successfully",
        **result,
        "filename": filename,
    }


# ============================================================================
# Parameter Contexts
# ============================================================================


@router.get("/{instance_id}/ops/parameters")
async def get_parameter_contexts(
    instance_id: int,
    search: str = None,
    identifier_type: str = "name",
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    contexts = await _execute_with_retry(
        instance_id,
        lambda: param_ops.list_parameter_contexts(search, identifier_type),
    )
    return ParameterContextListResponse(
        status="success", parameter_contexts=contexts, count=len(contexts)
    )


@router.get("/{instance_id}/ops/parameter-contexts/{context_id}")
async def get_parameter_context(
    instance_id: int,
    context_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    try:
        context = await _execute_with_retry(
            instance_id,
            lambda: param_ops.get_parameter_context(context_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {"status": "success", "parameter_context": context}


@router.post("/{instance_id}/ops/parameter-contexts")
async def create_parameter_context(
    instance_id: int,
    data: ParameterContextCreate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    params = [p.model_dump() for p in data.parameters] if data.parameters else []
    result = await _execute_with_retry(
        instance_id,
        lambda: param_ops.create_parameter_context(data.name, data.description, params),
    )
    return {
        "status": "success",
        "message": "Parameter context created",
        "parameter_context": result,
    }


@router.put("/{instance_id}/ops/parameter-contexts/{context_id}")
async def update_parameter_context(
    instance_id: int,
    context_id: str,
    data: ParameterContextUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    params = [p.model_dump() for p in data.parameters] if data.parameters else None
    result = await _execute_with_retry(
        instance_id,
        lambda: param_ops.update_parameter_context(
            context_id,
            data.name,
            data.description,
            params,
            data.inherited_parameter_contexts,
        ),
    )
    return {
        "status": "success",
        "message": "Parameter context updated",
        "parameter_context": result,
    }


@router.delete("/{instance_id}/ops/parameter-contexts/{context_id}")
async def delete_parameter_context(
    instance_id: int,
    context_id: str,
    current_user: dict = Depends(require_permission("nifi", "delete")),
):
    await _execute_with_retry(
        instance_id,
        lambda: param_ops.delete_parameter_context(context_id),
    )
    return {"status": "success", "message": "Parameter context deleted"}


# ============================================================================
# Process Groups
# ============================================================================


@router.get("/{instance_id}/ops/process-group")
async def get_process_group(
    instance_id: int,
    id: str = None,
    name: str = None,
    greedy: bool = True,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: pg_ops.get_process_group(identifier=id, name=name, greedy=greedy),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {"status": "success", **result}


@router.get("/{instance_id}/ops/process-groups/{pg_id}/children")
async def list_child_process_groups(
    instance_id: int,
    pg_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    children = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.list_child_process_groups(pg_id),
    )
    return {"status": "success", "process_groups": children, "count": len(children)}


@router.get("/{instance_id}/ops/process-groups/all-paths")
async def get_all_process_group_paths(
    instance_id: int,
    start_pg_id: str = "root",
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """
    Get all process groups recursively with their full paths.

    Returns a flat list of all process groups in the NiFi instance with:
    - id: Process group ID
    - name: Process group name
    - path: Full path (e.g., "/Parent/Child")
    - level: Depth in hierarchy (0 for root)
    - formatted_path: Display-friendly path (e.g., "Parent → Child")
    """
    result = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.get_all_process_group_paths(start_pg_id),
    )
    pgs = result["process_groups"]
    return {
        "status": "success",
        "process_groups": pgs,
        "count": len(pgs),
        "root_id": result["root_id"],
    }


@router.get("/{instance_id}/ops/process-groups/{pg_id}/output-ports")
async def get_output_ports(
    instance_id: int,
    pg_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    ports = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.get_output_ports(pg_id),
    )
    return {
        "status": "success",
        "process_group_id": pg_id,
        "ports": ports,
        "count": len(ports),
    }


@router.get("/{instance_id}/ops/process-groups/{pg_id}/input-ports")
async def get_input_ports(
    instance_id: int,
    pg_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    ports = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.get_input_ports(pg_id),
    )
    return {
        "status": "success",
        "process_group_id": pg_id,
        "input_ports": ports,
        "count": len(ports),
    }


@router.get("/{instance_id}/ops/process-groups/{pg_id}/processors")
async def list_processors(
    instance_id: int,
    pg_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    processors = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.list_processors(pg_id),
    )
    return {
        "status": "success",
        "process_group_id": pg_id,
        "processors": processors,
        "count": len(processors),
    }


@router.post("/{instance_id}/ops/process-groups/{pg_id}/connections")
async def create_connection(
    instance_id: int,
    pg_id: str,
    data: ConnectionRequest,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    result = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.create_connection(
            data.source_id, data.target_id, pg_id, data.name, data.relationships
        ),
    )
    return ConnectionResponse(status="success", message="Connection created", **result)


@router.post("/{instance_id}/ops/process-groups/{pg_id}/assign-parameter-context")
async def assign_parameter_context(
    instance_id: int,
    pg_id: str,
    data: AssignParameterContextRequest,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    await _execute_with_retry(
        instance_id,
        lambda: pg_ops.assign_parameter_context(
            pg_id, data.parameter_context_id, data.cascade
        ),
    )
    return AssignParameterContextResponse(
        status="success",
        message="Parameter context assigned",
        process_group_id=pg_id,
        parameter_context_id=data.parameter_context_id,
        cascade=data.cascade,
    )


# ============================================================================
# Processors
# ============================================================================


@router.get("/{instance_id}/ops/processors/{processor_id}/configuration")
async def get_processor_configuration(
    instance_id: int,
    processor_id: str,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    try:
        config = await _execute_with_retry(
            instance_id,
            lambda: proc_ops.get_processor_configuration(processor_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ProcessorConfigurationResponse(status="success", processor=config)


@router.put("/{instance_id}/ops/processors/{processor_id}/configuration")
async def update_processor_configuration(
    instance_id: int,
    processor_id: str,
    config_update: ProcessorConfigurationUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    update_dict = config_update.model_dump(exclude_none=True)
    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: proc_ops.update_processor_configuration(processor_id, update_dict),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ProcessorConfigurationUpdateResponse(
        status="success", message="Configuration updated", **result
    )


# ============================================================================
# Version Control
# ============================================================================


@router.post("/{instance_id}/ops/process-groups/{pg_id}/update-version")
async def update_process_group_version(
    instance_id: int,
    pg_id: str,
    version_request: dict,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    await _execute_with_retry(
        instance_id,
        lambda: ver_ops.update_process_group_version(
            pg_id, version_request.get("version")
        ),
        normalized_url=True,
    )
    return {
        "status": "success",
        "message": "Process group updated",
        "process_group_id": pg_id,
    }


@router.post("/{instance_id}/ops/process-groups/{pg_id}/stop-versioning")
async def stop_process_group_versioning(
    instance_id: int,
    pg_id: str,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    try:
        was_versioned = await _execute_with_retry(
            instance_id,
            lambda: ver_ops.stop_version_control(pg_id),
            normalized_url=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {
        "status": "success",
        "message": "Version control stopped"
        if was_versioned
        else "Not under version control",
        "process_group_id": pg_id,
        "was_versioned": was_versioned,
    }


# ---------------------------------------------------------------------------
# Monitoring endpoints
# ---------------------------------------------------------------------------


@router.get("/{instance_id}/ops/system-diagnostics")
async def get_system_diagnostics(
    instance_id: int,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Get system diagnostics (heap, CPU, threads, storage) for a NiFi instance."""
    import nipyapi

    try:
        diagnostics = await _execute_with_retry(
            instance_id,
            lambda: nipyapi.system.get_system_diagnostics(),
        )
        data = diagnostics.to_dict() if hasattr(diagnostics, "to_dict") else diagnostics
        return {"status": "success", "instance_id": instance_id, "data": data}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Error getting system diagnostics for instance %d: %s", instance_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get system diagnostics: %s" % str(exc),
        )


@router.get("/{instance_id}/ops/process-groups/{pg_id}/status")
async def get_process_group_status(
    instance_id: int,
    pg_id: str,
    detail: str = "all",
    recursive: bool = False,
    nodewise: bool = False,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Get status of a specific NiFi process group.

    Parameters:

    - **detail**: `names` returns a simple `{name: id}` mapping; `all` returns the full status entity.
    - **recursive**: Whether all descendant groups and the status of their content will be included.
      When invoked on the root group with `recursive=true`, it returns the current status of every
      component in the flow. Defaults to `false`.
    - **nodewise**: Whether to include the per-node breakdown. Defaults to `false`.
    """
    import nipyapi

    if detail not in ("names", "all"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="detail must be 'names' or 'all'",
        )
    try:
        pg_status = await _execute_with_retry(
            instance_id,
            lambda: nipyapi.nifi.FlowApi().get_process_group_status(
                id=pg_id,
                recursive=recursive,
                nodewise=nodewise,
            ),
        )
        if detail == "names":
            inner = getattr(pg_status, "process_group_status", None)
            name = getattr(inner, "name", pg_id) if inner else pg_id
            data = {name: pg_id}
        else:
            data = pg_status.to_dict() if hasattr(pg_status, "to_dict") else pg_status
        return {
            "status": "success",
            "instance_id": instance_id,
            "process_group_id": pg_id,
            "detail": detail,
            "recursive": recursive,
            "nodewise": nodewise,
            "data": data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Error getting process group %s status for instance %d: %s",
            pg_id,
            instance_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get process group status: %s" % str(exc),
        )


@router.get("/{instance_id}/ops/process-groups/{pg_id}/status/canvas")
async def get_process_group_status_canvas(
    instance_id: int,
    pg_id: str,
    detail: str = "all",
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Get status of a specific NiFi process group using the canvas API.

    Uses `nipyapi.canvas.get_process_group_status()`, which returns a
    `ProcessGroupEntity` (richer component-level detail) rather than the
    `ProcessGroupStatusEntity` returned by the low-level Flow API endpoint
    (`/status`).

    Parameters:

    - **detail**: `names` returns a simple `{name: id}` mapping; `all` returns
      the full `ProcessGroupEntity` including component status snapshots.
    """
    from services.nifi.operations.process_groups import (
        get_process_group_status_canvas as _canvas_status,
    )

    if detail not in ("names", "all"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="detail must be 'names' or 'all'",
        )
    try:
        pg_status = await _execute_with_retry(
            instance_id,
            lambda: _canvas_status(pg_id),
        )
        if detail == "names":
            data = {pg_status["name"]: pg_id}
        else:
            data = pg_status["raw"]
        return {
            "status": "success",
            "instance_id": instance_id,
            "process_group_id": pg_id,
            "detail": detail,
            "data": data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Error getting canvas process group %s status for instance %d: %s",
            pg_id,
            instance_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get process group canvas status: %s" % str(exc),
        )


@router.get("/{instance_id}/ops/components")
async def list_components_by_kind(
    instance_id: int,
    kind: str,
    pg_id: str = "root",
    descendants: bool = True,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all NiFi components of a given kind.

    Valid values for **kind**:

    - `input_ports` – Input ports within process groups
    - `output_ports` – Output ports within process groups
    - `funnels` – Funnels
    - `controllers` – Controller services
    - `connections` – Connections between components
    - `remote_process_groups` – Remote process groups (RPGs)
    """
    from nipyapi import canvas

    try:
        raw_list = await _execute_with_retry(
            instance_id,
            lambda: canvas.list_all_by_kind(
                kind=kind, pg_id=pg_id, descendants=descendants
            )
            or [],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to list components by kind '%s': %s", kind, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list components by kind: %s" % str(exc),
        )

    components = [mgmt_ops.serialize_component_by_kind(item, kind) for item in raw_list]

    return {
        "status": "success",
        "kind": kind,
        "pg_id": pg_id,
        "components": components,
        "count": len(components),
    }


# ============================================================================
# Provenance
# ============================================================================


@router.get("/{instance_id}/ops/provenance/component/{component_id}")
async def get_component_provenance(
    instance_id: int,
    component_id: str,
    max_results: int = 100,
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """
    Get provenance events for a NiFi component (processor, port, etc.).

    Submits a provenance query filtered by component UUID, polls until
    complete, and returns the full result. The query is automatically
    deleted from NiFi after retrieval.

    - **component_id**: NiFi component UUID
    - **max_results**: Maximum number of events (default 100)
    - **start_date**: Earliest event time filter (NiFi date format)
    - **end_date**: Latest event time filter (NiFi date format)
    """
    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: prov_ops.get_component_provenance_events(
                component_id, max_results, start_date, end_date
            ),
        )
    except TimeoutError as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {
        "status": "success",
        "instance_id": instance_id,
        "component_id": component_id,
        "data": result,
    }


@router.get("/{instance_id}/ops/provenance/lineage/{flow_file_uuid}")
async def get_flow_lineage(
    instance_id: int,
    flow_file_uuid: str,
    component_id: str | None = None,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """
    Trace a FlowFile through all NiFi components it passed through.

    Returns an ordered list of components (sorted by event timestamp)
    that the FlowFile visited, plus the raw lineage graph (nodes/links).
    Useful for debugging where a flow stopped.

    - **flow_file_uuid**: UUID of the FlowFile to trace
    - **component_id**: Optional starting component UUID — annotates the
      matching node in `ordered_path` with `is_starting_component: true`
    """
    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: prov_ops.get_flow_lineage(flow_file_uuid, component_id),
        )
    except TimeoutError as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {"status": "success", "instance_id": instance_id, **result}


@router.get("/{instance_id}/ops/provenance/lineage-by-filename/{filename:path}")
async def get_flow_lineage_by_filename(
    instance_id: int,
    filename: str,
    max_results: int = 10,
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """
    Trace FlowFiles by filename through all NiFi components they passed through.

    Searches provenance for events matching the given filename, extracts the
    unique FlowFile UUIDs, and returns lineage for each. Useful when you know
    the filename but not the FlowFile UUID.

    - **filename**: Exact filename of the FlowFile (URL-encoded if it contains slashes)
    - **max_results**: Maximum number of provenance events to search (default 10)
    - **start_date**: Earliest event time filter (NiFi date format)
    - **end_date**: Latest event time filter (NiFi date format)
    """
    try:
        results = await _execute_with_retry(
            instance_id,
            lambda: prov_ops.get_flow_lineage_by_filename(
                filename, max_results, start_date, end_date
            ),
        )
    except TimeoutError as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return {
        "status": "success",
        "instance_id": instance_id,
        "filename": filename,
        "lineage_count": len(results),
        "lineages": results,
    }
