"""NiFi install endpoints - check process group paths for managed flows."""

import logging
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from core.auth import require_permission
from services.nifi import install_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/install", tags=["nifi-install"])


class PathStatus(BaseModel):
    """Status of a single process group path."""

    path: str
    exists: bool


class CheckPathResponse(BaseModel):
    """Response for the check-path endpoint."""

    status: List[PathStatus]


@router.get("/check-path", response_model=CheckPathResponse)
async def check_path(
    instance_id: int = Query(..., description="NiFi instance ID"),
    path_type: Literal["source", "destination"] = Query(
        ..., description="Path type to check (source or destination)"
    ),
    user: dict = Depends(require_permission("nifi", "read")),
):
    """Check if process groups exist for all managed flows.

    For each flow, builds the expected path hierarchy and checks whether
    the corresponding process groups exist in the NiFi instance.
    """
    try:
        items = install_service.check_path(instance_id, path_type)
        return CheckPathResponse(status=[PathStatus(**item) for item in items])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Error checking %s paths for instance %d: %s", path_type, instance_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
