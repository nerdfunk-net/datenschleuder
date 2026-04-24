"""NiFi install endpoints - check process group paths for managed flows."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.auth import require_permission
from models.nifi import PathStatus, CheckPathResponse
from services.nifi import install_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/install", tags=["nifi-install"])


@router.get("/check-path", response_model=CheckPathResponse)
def check_path(
    cluster_id: int = Query(..., description="NiFi cluster ID"),
    path_type: Literal["source", "destination"] = Query(
        ..., description="Path type to check (source or destination)"
    ),
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Check if process groups exist for all managed flows.

    For each flow, builds the expected path hierarchy and checks whether
    the corresponding process groups exist in the NiFi cluster's primary instance.
    """
    try:
        items = install_service.check_path(cluster_id, path_type)
        return CheckPathResponse(status=[PathStatus(**item) for item in items])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(
            "Error checking %s paths for cluster %d: %s", path_type, cluster_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
