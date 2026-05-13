"""NiFi deployment endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from models.nifi import DeploymentRequest, DeploymentResponse
from services.nifi import deploy_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/instances", tags=["nifi-deploy"])


@router.post("/{instance_id}/deploy", response_model=DeploymentResponse)
def deploy_flow(
    instance_id: int,
    deployment: DeploymentRequest,
    current_user: dict = Depends(require_permission("nifi", "execute")),
):
    """Deploy a flow from registry to a NiFi instance."""
    try:
        result = deploy_service.deploy_flow(instance_id, deployment.model_dump())
        return DeploymentResponse(**result)
    except ValueError as e:
        logger.warning("deploy_flow validation error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid deployment configuration",
        )
    except Exception as e:
        raise_internal_server_error(
            log_message="Failed to deploy flow",
            exc=e,
            operation="deploy_flow",
        )
