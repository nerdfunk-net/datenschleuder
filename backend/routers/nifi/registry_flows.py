"""Registry flow management endpoints."""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.auth import require_permission
from models.nifi_operations import RegistryFlowCreate, RegistryFlowResponse
from services.nifi import registry_flow_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/registry-flows", tags=["nifi-registry-flows"])


@router.get("/", response_model=List[RegistryFlowResponse])
async def list_registry_flows(
    nifi_instance: Optional[int] = Query(
        None, description="Filter by NiFi instance ID"
    ),
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all registry flows, optionally filtered by NiFi instance."""
    return registry_flow_service.list_flows(nifi_instance)


@router.get("/templates/list")
async def list_flow_templates(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all flows formatted for template selection dropdown."""
    return registry_flow_service.list_templates()


@router.get("/{flow_id}", response_model=RegistryFlowResponse)
async def get_registry_flow(
    flow_id: int,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Get a specific registry flow."""
    flow = registry_flow_service.get_flow(flow_id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registry flow with id %d not found" % flow_id,
        )
    return flow


@router.post("/")
async def create_registry_flows(
    flows: List[RegistryFlowCreate],
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Create one or more registry flows."""
    flows_data = [f.model_dump() for f in flows]
    result = registry_flow_service.create_flows(flows_data)
    return {
        "message": "Created %d flows, skipped %d duplicates"
        % (result["created"], result["skipped"]),
        **result,
    }


@router.delete("/{flow_id}")
async def delete_registry_flow(
    flow_id: int,
    current_user: dict = Depends(require_permission("nifi", "delete")),
):
    """Delete a registry flow."""
    if not registry_flow_service.delete_flow(flow_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registry flow with id %d not found" % flow_id,
        )
    return {"message": "Registry flow deleted successfully"}
