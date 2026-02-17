"""NiFi instance CRUD endpoints."""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import verify_token, require_permission
from models.nifi_instance import (
    NifiInstanceCreate,
    NifiInstanceUpdate,
    NifiInstanceResponse,
    NifiInstanceTestConnection,
)
from services.nifi import instance_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/instances", tags=["nifi-instances"])


@router.get("/", response_model=List[NifiInstanceResponse])
async def list_nifi_instances(
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Get all NiFi instances."""
    return instance_service.list_instances()


@router.get("/{instance_id}", response_model=NifiInstanceResponse)
async def get_nifi_instance(
    instance_id: int,
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Get a specific NiFi instance."""
    instance = instance_service.get_instance(instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    return instance


@router.post("/", response_model=NifiInstanceResponse)
async def create_nifi_instance(
    data: NifiInstanceCreate,
    user: dict = Depends(require_permission("nifi", "write")),
):
    """Create a new NiFi instance."""
    try:
        return instance_service.create_instance(
            name=data.name,
            hierarchy_attribute=data.hierarchy_attribute,
            hierarchy_value=data.hierarchy_value,
            nifi_url=data.nifi_url,
            username=data.username,
            password=data.password,
            use_ssl=data.use_ssl,
            verify_ssl=data.verify_ssl,
            certificate_name=data.certificate_name,
            check_hostname=data.check_hostname,
            oidc_provider_id=data.oidc_provider_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{instance_id}", response_model=NifiInstanceResponse)
async def update_nifi_instance(
    instance_id: int,
    data: NifiInstanceUpdate,
    user: dict = Depends(require_permission("nifi", "write")),
):
    """Update a NiFi instance."""
    update_data = data.model_dump(exclude_unset=True)
    instance = instance_service.update_instance(instance_id, **update_data)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    return instance


@router.delete("/{instance_id}")
async def delete_nifi_instance(
    instance_id: int,
    user: dict = Depends(require_permission("nifi", "delete")),
):
    """Delete a NiFi instance."""
    if not instance_service.delete_instance(instance_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi instance with ID %d not found" % instance_id,
        )
    return {"message": "NiFi instance deleted successfully"}


@router.post("/test")
async def test_nifi_connection(
    data: NifiInstanceTestConnection,
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Test connection with provided NiFi credentials (without saving)."""
    try:
        result = instance_service.test_new_connection(
            nifi_url=data.nifi_url,
            username=data.username,
            password=data.password,
            verify_ssl=data.verify_ssl,
            certificate_name=data.certificate_name,
            check_hostname=data.check_hostname,
            oidc_provider_id=data.oidc_provider_id,
        )
        return {
            "status": "success",
            "message": "Successfully connected to NiFi",
            "details": result,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "Connection failed: %s" % str(e),
            "details": {"connected": False, "nifi_url": data.nifi_url, "error": str(e)},
        }


@router.post("/{instance_id}/test-connection")
async def test_instance_connection(
    instance_id: int,
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Test connection for a specific NiFi instance."""
    try:
        result = instance_service.test_instance_connection(instance_id)
        return {
            "status": "success",
            "message": "Successfully connected to NiFi",
            "details": result,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        return {
            "status": "error",
            "message": "Connection failed: %s" % str(e),
            "details": {"connected": False, "error": str(e)},
        }
