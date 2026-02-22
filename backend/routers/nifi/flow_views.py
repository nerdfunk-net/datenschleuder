"""Flow view management endpoints."""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import verify_token, require_permission
from models.nifi_operations import FlowViewCreate, FlowViewUpdate, FlowViewResponse
from services.nifi import flow_view_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/flow-views", tags=["nifi-flow-views"])


@router.get("/", response_model=List[FlowViewResponse])
async def list_flow_views(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all flow views."""
    return flow_view_service.list_views()


@router.get("/{view_id}", response_model=FlowViewResponse)
async def get_flow_view(
    view_id: int,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Get a specific flow view."""
    view = flow_view_service.get_view(view_id)
    if not view:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="View with id %d not found" % view_id,
        )
    return view


@router.post("/")
async def create_flow_view(
    data: FlowViewCreate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Create a new flow view."""
    try:
        view = flow_view_service.create_view(
            name=data.name,
            visible_columns=data.visible_columns,
            description=data.description,
            column_widths=data.column_widths,
            is_default=data.is_default,
            created_by=user.get("username", "admin"),
        )
        return {"message": "Flow view created successfully", "id": view.id}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{view_id}")
async def update_flow_view(
    view_id: int,
    data: FlowViewUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Update a flow view."""
    try:
        update_data = data.model_dump(exclude_unset=True)
        view = flow_view_service.update_view(view_id, **update_data)
        if not view:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="View with id %d not found" % view_id,
            )
        return {"message": "Flow view updated successfully", "id": view.id}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{view_id}")
async def delete_flow_view(
    view_id: int,
    current_user: dict = Depends(require_permission("nifi", "delete")),
):
    """Delete a flow view."""
    if not flow_view_service.delete_view(view_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="View with id %d not found" % view_id,
        )
    return {"message": "Flow view deleted successfully"}


@router.post("/{view_id}/set-default")
async def set_default_view(
    view_id: int,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Set a view as the default."""
    view = flow_view_service.set_default(view_id)
    if not view:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="View with id %d not found" % view_id,
        )
    return {"message": "View '%s' set as default" % view.name}
