"""NiFi operations endpoints (registries, flows, params, PGs, processors, versions)."""

import logging
from typing import Dict, Any, Optional
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


def _setup_instance(instance_id: int):
    """Helper to get instance and configure connection."""
    instance = instance_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    nifi_connection_service.configure_from_instance(instance)
    return instance


def _setup_instance_normalized(instance_id: int):
    """Helper to get instance and configure connection with normalized URL."""
    instance = instance_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    nifi_connection_service.configure_from_instance(instance, normalize_url=True)
    return instance


# ============================================================================
# Registry Operations
# ============================================================================


@router.get("/{instance_id}/ops/registries")
async def get_registry_clients(
    instance_id: int,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        clients = reg_ops.list_registry_clients()
        return {"status": "success", "registry_clients": clients, "count": len(clients)}
    except Exception as e:
        return {"status": "error", "message": str(e), "registry_clients": [], "count": 0}


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets")
async def get_registry_buckets(
    instance_id: int,
    registry_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        result = reg_ops.get_registry_buckets(registry_id)
        return {"status": "success", **result}
    except Exception as e:
        return {"status": "error", "message": str(e), "buckets": [], "count": 0}


@router.get("/{instance_id}/ops/registries/{registry_id}/details")
async def get_registry_details(
    instance_id: int,
    registry_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        result = reg_ops.get_registry_details(registry_id)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/flows")
async def get_bucket_flows(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        result = reg_ops.get_bucket_flows(registry_id, bucket_id)
        return {"status": "success", **result}
    except Exception as e:
        return {"status": "error", "message": str(e), "flows": [], "count": 0}


@router.get("/{instance_id}/ops/registries/{registry_id}/buckets/{bucket_id}/flows/{flow_id}/versions")
async def get_flow_versions(
    instance_id: int,
    registry_id: str,
    bucket_id: str,
    flow_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        result = reg_ops.get_flow_versions(registry_id, bucket_id, flow_id)
        return {"status": "success", **result}
    except Exception as e:
        return {"status": "error", "message": str(e), "versions": [], "count": 0}


# ============================================================================
# Flow Export/Import
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
    _setup_instance(instance_id)
    try:
        result = flow_ops.export_flow(registry_id, bucket_id, flow_id, version, mode)
        return Response(
            content=result["content"],
            media_type=result["content_type"],
            headers={"Content-Disposition": "attachment; filename=%s" % result["filename"]},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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
    _setup_instance(instance_id)

    if not flow_name and not flow_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either flow_name or flow_id must be provided",
        )

    try:
        file_content = await file.read()
        encoded_flow = file_content.decode("utf-8")

        result = flow_ops.import_flow(registry_id, bucket_id, encoded_flow, flow_name, flow_id)
        return {"status": "success", "message": "Flow imported successfully", **result, "filename": file.filename}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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
    _setup_instance(instance_id)
    try:
        contexts = param_ops.list_parameter_contexts(search, identifier_type)
        return ParameterContextListResponse(
            status="success", parameter_contexts=contexts, count=len(contexts)
        )
    except Exception as e:
        return ParameterContextListResponse(
            status="error", parameter_contexts=[], count=0, message=str(e)
        )


@router.get("/{instance_id}/ops/parameter-contexts/{context_id}")
async def get_parameter_context(
    instance_id: int,
    context_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        context = param_ops.get_parameter_context(context_id)
        return {"status": "success", "parameter_context": context}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{instance_id}/ops/parameter-contexts")
async def create_parameter_context(
    instance_id: int,
    data: ParameterContextCreate,
    user: dict = Depends(require_permission("nifi", "write")),
):
    _setup_instance(instance_id)
    try:
        params = [p.model_dump() for p in data.parameters] if data.parameters else []
        result = param_ops.create_parameter_context(data.name, data.description, params)
        return {"status": "success", "message": "Parameter context created", "parameter_context": result}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{instance_id}/ops/parameter-contexts/{context_id}")
async def update_parameter_context(
    instance_id: int,
    context_id: str,
    data: ParameterContextUpdate,
    user: dict = Depends(require_permission("nifi", "write")),
):
    _setup_instance(instance_id)
    try:
        params = [p.model_dump() for p in data.parameters] if data.parameters else None
        result = param_ops.update_parameter_context(
            context_id, data.name, data.description, params, data.inherited_parameter_contexts
        )
        return {"status": "success", "message": "Parameter context updated", "parameter_context": result}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{instance_id}/ops/parameter-contexts/{context_id}")
async def delete_parameter_context(
    instance_id: int,
    context_id: str,
    user: dict = Depends(require_permission("nifi", "delete")),
):
    _setup_instance(instance_id)
    try:
        param_ops.delete_parameter_context(context_id)
        return {"status": "success", "message": "Parameter context deleted"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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
    _setup_instance(instance_id)
    try:
        result = pg_ops.get_process_group(identifier=id, name=name, greedy=greedy)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{instance_id}/ops/process-groups/{pg_id}/children")
async def list_child_process_groups(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        children = pg_ops.list_child_process_groups(pg_id)
        return {"status": "success", "process_groups": children, "count": len(children)}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{instance_id}/ops/process-groups/{pg_id}/output-ports")
async def get_output_ports(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    ports = pg_ops.get_output_ports(pg_id)
    return {"status": "success", "process_group_id": pg_id, "ports": ports, "count": len(ports)}


@router.get("/{instance_id}/ops/process-groups/{pg_id}/input-ports")
async def get_input_ports(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    ports = pg_ops.get_input_ports(pg_id)
    return {"status": "success", "process_group_id": pg_id, "input_ports": ports, "count": len(ports)}


@router.get("/{instance_id}/ops/process-groups/{pg_id}/processors")
async def list_processors(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    processors = pg_ops.list_processors(pg_id)
    return {"status": "success", "process_group_id": pg_id, "processors": processors, "count": len(processors)}


@router.post("/{instance_id}/ops/process-groups/{pg_id}/connections")
async def create_connection(
    instance_id: int,
    pg_id: str,
    data: ConnectionRequest,
    user: dict = Depends(require_permission("nifi", "write")),
):
    _setup_instance(instance_id)
    try:
        result = pg_ops.create_connection(
            data.source_id, data.target_id, pg_id, data.name, data.relationships
        )
        return ConnectionResponse(status="success", message="Connection created", **result)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{instance_id}/ops/process-groups/{pg_id}/assign-parameter-context")
async def assign_parameter_context(
    instance_id: int,
    pg_id: str,
    data: AssignParameterContextRequest,
    user: dict = Depends(require_permission("nifi", "write")),
):
    _setup_instance(instance_id)
    try:
        pg_ops.assign_parameter_context(pg_id, data.parameter_context_id, data.cascade)
        return AssignParameterContextResponse(
            status="success",
            message="Parameter context assigned",
            process_group_id=pg_id,
            parameter_context_id=data.parameter_context_id,
            cascade=data.cascade,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# Processors
# ============================================================================


@router.get("/{instance_id}/ops/processors/{processor_id}/configuration")
async def get_processor_configuration(
    instance_id: int,
    processor_id: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    _setup_instance(instance_id)
    try:
        config = proc_ops.get_processor_configuration(processor_id)
        return ProcessorConfigurationResponse(status="success", processor=config)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/{instance_id}/ops/processors/{processor_id}/configuration")
async def update_processor_configuration(
    instance_id: int,
    processor_id: str,
    config_update: ProcessorConfigurationUpdate,
    user: dict = Depends(require_permission("nifi", "write")),
):
    _setup_instance(instance_id)
    try:
        update_dict = config_update.model_dump(exclude_none=True)
        result = proc_ops.update_processor_configuration(processor_id, update_dict)
        return ProcessorConfigurationUpdateResponse(
            status="success", message="Configuration updated", **result
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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
    _setup_instance_normalized(instance_id)
    try:
        ver_ops.update_process_group_version(pg_id, version_request.get("version"))
        return {"status": "success", "message": "Process group updated", "process_group_id": pg_id}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{instance_id}/ops/process-groups/{pg_id}/stop-versioning")
async def stop_process_group_versioning(
    instance_id: int,
    pg_id: str,
    user: dict = Depends(require_permission("nifi", "write")),
):
    _setup_instance_normalized(instance_id)
    try:
        was_versioned = ver_ops.stop_version_control(pg_id)
        return {
            "status": "success",
            "message": "Version control stopped" if was_versioned else "Not under version control",
            "process_group_id": pg_id,
            "was_versioned": was_versioned,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
