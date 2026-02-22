"""NiFi flow CRUD endpoints."""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.nifi_operations import NifiFlowCreate, NifiFlowUpdate, NifiFlowResponse
from services.nifi import nifi_flow_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/flows", tags=["nifi-flows"])


@router.get("/columns")
async def get_flow_columns(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Return the column list for the nifi_flows table with human-readable labels."""
    return {"columns": nifi_flow_service.get_flow_columns()}


@router.get("/", response_model=List[NifiFlowResponse])
async def list_flows(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all NiFi flows."""
    return nifi_flow_service.list_flows()


@router.post("/", response_model=NifiFlowResponse)
async def create_flow(
    data: NifiFlowCreate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Create a new NiFi flow."""
    try:
        return nifi_flow_service.create_flow(
            hierarchy_values=data.hierarchy_values,
            src_connection_param=data.src_connection_param,
            dest_connection_param=data.dest_connection_param,
            name=data.name,
            contact=data.contact,
            src_template_id=data.src_template_id,
            dest_template_id=data.dest_template_id,
            active=data.active,
            description=data.description,
            creator_name=data.creator_name or current_user.get("username"),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{flow_id}", response_model=NifiFlowResponse)
async def update_flow(
    flow_id: int,
    data: NifiFlowUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Update a NiFi flow."""
    try:
        update_data = data.model_dump(exclude_unset=True)
        flow = nifi_flow_service.update_flow(flow_id, **update_data)
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Flow with id %d not found" % flow_id,
            )
        return flow
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{flow_id}/copy", response_model=NifiFlowResponse)
async def copy_flow(
    flow_id: int,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Copy an existing NiFi flow."""
    flow = nifi_flow_service.copy_flow(flow_id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow with id %d not found" % flow_id,
        )
    return flow


@router.delete("/{flow_id}")
async def delete_flow(
    flow_id: int,
    current_user: dict = Depends(require_permission("nifi", "delete")),
):
    """Delete a NiFi flow."""
    if not nifi_flow_service.delete_flow(flow_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow with id %d not found" % flow_id,
        )
    return {"message": "Flow deleted successfully"}
