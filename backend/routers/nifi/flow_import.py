"""Router for importing NiFi flows from a Git repository file."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_git_repo_manager
from models.flow_import import FlowImportRequest, FlowImportResponse
from services.nifi import flow_import_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/flows", tags=["nifi-flow-import"])


@router.post("/import", response_model=FlowImportResponse)
def import_flows(
    request: FlowImportRequest,
    current_user: dict = Depends(require_permission("nifi", "write")),
    git_repo_manager=Depends(get_git_repo_manager),
) -> FlowImportResponse:
    """Import flows from a JSON or CSV file stored in a Git repository.

    Pass ``dry_run=true`` to preview what would be created without writing to the database.
    """
    try:
        return flow_import_service.import_flows_from_repo(
            repo_id=request.repo_id,
            file_path=request.file_path,
            dry_run=request.dry_run,
            git_repo_manager=git_repo_manager,
            current_username=current_user.get("sub", "unknown"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error during flow import: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {exc}",
        )
