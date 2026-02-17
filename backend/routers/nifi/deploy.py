"""NiFi deployment endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.nifi_deployment import DeploymentRequest, DeploymentResponse
from services.nifi import deploy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/instances", tags=["nifi-deploy"])


@router.post("/{instance_id}/deploy", response_model=DeploymentResponse)
async def deploy_flow(
    instance_id: int,
    deployment: DeploymentRequest,
    user: dict = Depends(require_permission("nifi.deploy", "write")),
):
    """Deploy a flow from registry to a NiFi instance."""
    try:
        result = deploy_service.deploy_flow(
            instance_id, deployment.model_dump()
        )
        return DeploymentResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Deployment failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deploy flow: %s" % str(e),
        )
