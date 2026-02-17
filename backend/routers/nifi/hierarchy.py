"""NiFi hierarchy configuration endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.nifi_hierarchy import HierarchyConfig, HierarchyValuesRequest
from services.nifi import hierarchy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/hierarchy", tags=["nifi-hierarchy"])


@router.get("/")
async def get_hierarchy_config(
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Get hierarchical data format settings."""
    return hierarchy_service.get_hierarchy_config()


@router.get("/flow-count")
async def get_flow_count(
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Return the number of existing nifi_flows rows."""
    count = hierarchy_service.get_flow_count()
    return {"count": count}


@router.post("/")
async def save_hierarchy_config(
    settings: HierarchyConfig,
    user: dict = Depends(require_permission("nifi.settings", "write")),
):
    """Save hierarchical data format settings and delete all existing flows."""
    try:
        hierarchy_data = [attr.model_dump() for attr in settings.hierarchy]
        deleted_flows_count = hierarchy_service.save_hierarchy_config(hierarchy_data)
        return {
            "message": "Hierarchy settings saved successfully",
            "deleted_flows_count": deleted_flows_count,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/values/{attribute_name}")
async def get_attribute_values(
    attribute_name: str,
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Get all values for a specific attribute."""
    values = hierarchy_service.get_attribute_values(attribute_name)
    return {"attribute_name": attribute_name, "values": values}


@router.post("/values")
async def save_attribute_values(
    data: HierarchyValuesRequest,
    user: dict = Depends(require_permission("nifi.settings", "write")),
):
    """Save/replace all values for a specific attribute."""
    count = hierarchy_service.save_attribute_values(data.attribute_name, data.values)
    return {"message": "Saved %d values for %s" % (count, data.attribute_name)}


@router.delete("/values/{attribute_name}")
async def delete_attribute_values(
    attribute_name: str,
    user: dict = Depends(require_permission("nifi.settings", "write")),
):
    """Delete all values for a specific attribute."""
    count = hierarchy_service.delete_attribute_values(attribute_name)
    return {"message": "Deleted %d values for %s" % (count, attribute_name)}


@router.get("/deploy")
async def get_deployment_settings(
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Get deployment settings."""
    return hierarchy_service.get_deployment_settings()


@router.post("/deploy")
async def save_deployment_settings(
    data: dict,
    user: dict = Depends(require_permission("nifi.settings", "write")),
):
    """Save deployment settings."""
    hierarchy_service.save_deployment_settings(data)
    return {"message": "Deployment settings saved successfully"}
