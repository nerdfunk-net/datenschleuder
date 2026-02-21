"""NiFi operations endpoints (registries, flows, params, PGs, processors, versions)."""

import asyncio
import logging
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import Response

from core.auth import require_permission
from models.nifi_deployment import (
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
from services.nifi.connection import nifi_connection_service
from services.nifi import instance_service
from services.nifi.operations import (
    registries as reg_ops,
    flows as flow_ops,
    parameters as param_ops,
    process_groups as pg_ops,
    processors as proc_ops,
    versions as ver_ops,
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

def _setup_instance(instance_id: int):
    """Fetch instance from DB and configure nipyapi connection."""
    instance = instance_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    nifi_connection_service.configure_from_instance(instance)
    return instance


def _setup_instance_normalized(instance_id: int):
    """Fetch instance from DB and configure nipyapi with a normalised API URL."""
    instance = instance_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    nifi_connection_service.configure_from_instance(instance, normalize_url=True)
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

    Rules:
    - ValueError  → re-raised immediately (resource not found / bad input).
    - HTTPException → re-raised immediately (already a handled error).
    - Any other exception → logged and retried after _NIFI_RETRY_DELAY seconds.
    - If every attempt fails → HTTPException(503) with a descriptive message.

    The connection setup is repeated on every attempt so that re-authentication
    is attempted after a transient failure (relevant for OIDC / username auth).
    """
    last_error: Exception = RuntimeError("No attempts made")

    for attempt in range(1, _NIFI_MAX_RETRIES + 1):
        try:
            if normalized_url:
                _setup_instance_normalized(instance_id)
            else:
                _setup_instance(instance_id)
            return operation()

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
    user: dict = Depends(require_permission("nifi", "read")),
):
    clients = await _execute_with_retry(instance_id, reg_ops.list_registry_clients)
    return {"status": "success", "registry_clients": clients, "count": len(clients)}


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets")
async def get_registry_buckets(
    instance_id: int,
    registry_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
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
    user: dict = Depends(require_permission("nifi", "read")),
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
    user: dict = Depends(require_permission("nifi", "read")),
):
    result = await _execute_with_retry(
        instance_id,
        lambda: reg_ops.get_bucket_flows(registry_id, bucket_id),
    )
    return {"status": "success", **result}


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/flows/{flow_id}/versions")
async def get_flow_versions(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    flow_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    result = await _execute_with_retry(
        instance_id,
        lambda: reg_ops.get_flow_versions(registry_id, bucket_id, flow_id),
    )
    return {"status": "success", **result}


# ============================================================================
# Flow Export / Import
# ============================================================================


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/export-flow")
async def export_flow(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    flow_id: str,
    version: str = None,
    mode: str = "json",
    user: dict = Depends(require_permission("nifi", "read")),
):
    try:
        result = await _execute_with_retry(
            instance_id,
            lambda: flow_ops.export_flow(registry_id, bucket_id, flow_id, version, mode),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return Response(
        content=result["content"],
        media_type=result["content_type"],
        headers={"Content-Disposition": "attachment; filename=%s" % result["filename"]},
    )


@router.post("/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/import-flow")
async def import_flow(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    file: UploadFile = File(...),
    flow_name: str = Form(None),
    flow_id: str = Form(None),
    user: dict = Depends(require_permission("nifi", "write")),
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
            lambda: flow_ops.import_flow(registry_id, bucket_id, encoded_flow, flow_name, flow_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"status": "success", "message": "Flow imported successfully", **result, "filename": filename}


# ============================================================================
# Parameter Contexts
# ============================================================================


@router.get("/{instance_id}/ops/parameters")
async def get_parameter_contexts(
    instance_id: int,
    search: str = None,
    identifier_type: str = "name",
    user: dict = Depends(require_permission("nifi", "read")),
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
    user: dict = Depends(require_permission("nifi", "read")),
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
    user: dict = Depends(require_permission("nifi", "write")),
):
    params = [p.model_dump() for p in data.parameters] if data.parameters else []
    result = await _execute_with_retry(
        instance_id,
        lambda: param_ops.create_parameter_context(data.name, data.description, params),
    )
    return {"status": "success", "message": "Parameter context created", "parameter_context": result}


@router.put("/{instance_id}/ops/parameter-contexts/{context_id}")
async def update_parameter_context(
    instance_id: int,
    context_id: str,
    data: ParameterContextUpdate,
    user: dict = Depends(require_permission("nifi", "write")),
):
    params = [p.model_dump() for p in data.parameters] if data.parameters else None
    result = await _execute_with_retry(
        instance_id,
        lambda: param_ops.update_parameter_context(
            context_id, data.name, data.description, params, data.inherited_parameter_contexts
        ),
    )
    return {"status": "success", "message": "Parameter context updated", "parameter_context": result}


@router.delete("/{instance_id}/ops/parameter-contexts/{context_id}")
async def delete_parameter_context(
    instance_id: int,
    context_id: str,
    user: dict = Depends(require_permission("nifi", "delete")),
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
    user: dict = Depends(require_permission("nifi", "read")),
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
    user: dict = Depends(require_permission("nifi", "read")),
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
    user: dict = Depends(require_permission("nifi", "read")),
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
    return {"status": "success", "process_groups": pgs, "count": len(pgs), "root_id": result["root_id"]}


@router.get("/{instance_id}/ops/process-groups/{pg_id}/output-ports")
async def get_output_ports(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    ports = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.get_output_ports(pg_id),
    )
    return {"status": "success", "process_group_id": pg_id, "ports": ports, "count": len(ports)}


@router.get("/{instance_id}/ops/process-groups/{pg_id}/input-ports")
async def get_input_ports(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    ports = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.get_input_ports(pg_id),
    )
    return {"status": "success", "process_group_id": pg_id, "input_ports": ports, "count": len(ports)}


@router.get("/{instance_id}/ops/process-groups/{pg_id}/processors")
async def list_processors(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    processors = await _execute_with_retry(
        instance_id,
        lambda: pg_ops.list_processors(pg_id),
    )
    return {"status": "success", "process_group_id": pg_id, "processors": processors, "count": len(processors)}


@router.post("/{instance_id}/ops/process-groups/{pg_id}/connections")
async def create_connection(
    instance_id: int,
    pg_id: str,
    data: ConnectionRequest,
    user: dict = Depends(require_permission("nifi", "write")),
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
    user: dict = Depends(require_permission("nifi", "write")),
):
    await _execute_with_retry(
        instance_id,
        lambda: pg_ops.assign_parameter_context(pg_id, data.parameter_context_id, data.cascade),
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
    user: dict = Depends(require_permission("nifi", "read")),
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
    user: dict = Depends(require_permission("nifi", "write")),
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
    user: dict = Depends(require_permission("nifi", "write")),
):
    await _execute_with_retry(
        instance_id,
        lambda: ver_ops.update_process_group_version(pg_id, version_request.get("version")),
        normalized_url=True,
    )
    return {"status": "success", "message": "Process group updated", "process_group_id": pg_id}


@router.post("/{instance_id}/ops/process-groups/{pg_id}/stop-versioning")
async def stop_process_group_versioning(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "write")),
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
        "message": "Version control stopped" if was_versioned else "Not under version control",
        "process_group_id": pg_id,
        "was_versioned": was_versioned,
    }
