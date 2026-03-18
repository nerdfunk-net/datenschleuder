"""
Git repository debug operations router - Debug and diagnostic endpoints.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException

from core.auth import require_permission
from dependencies import get_git_auth_service, get_git_repo_manager
from services.settings.git.debug_service import GitDebugService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git-repositories", tags=["git-debug"])


@router.post("/{repo_id}/debug/read")
def debug_read_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Debug operation: Test reading a file from the repository."""
    try:
        service = GitDebugService(git_repo_manager, None)
        return service.test_read(repo_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Debug read test failed for repo %s: %s", repo_id, e)
        return {"success": False, "message": f"Debug test failed: {str(e)}", "details": {"error": str(e), "error_type": type(e).__name__, "stage": "repository_access"}}


@router.post("/{repo_id}/debug/write")
def debug_write_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Debug operation: Test writing a file to the repository."""
    try:
        service = GitDebugService(git_repo_manager, None)
        return service.test_write(repo_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Debug write test failed for repo %s: %s", repo_id, e)
        return {"success": False, "message": f"Debug test failed: {str(e)}", "details": {"error": str(e), "error_type": type(e).__name__, "stage": "repository_access"}}


@router.post("/{repo_id}/debug/delete")
def debug_delete_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Debug operation: Test deleting the test file from the repository."""
    try:
        service = GitDebugService(git_repo_manager, None)
        return service.test_delete(repo_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Debug delete test failed for repo %s: %s", repo_id, e)
        return {"success": False, "message": f"Debug test failed: {str(e)}", "details": {"error": str(e), "error_type": type(e).__name__, "stage": "repository_access"}}


@router.post("/{repo_id}/debug/push")
def debug_push_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
    git_repo_manager=Depends(get_git_repo_manager),
    git_auth_service=Depends(get_git_auth_service),
):
    """Debug operation: Test pushing changes to the remote repository."""
    try:
        service = GitDebugService(git_repo_manager, git_auth_service)
        return service.test_push(repo_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Debug push test failed for repo %s: %s", repo_id, e)
        return {"success": False, "message": f"Debug test failed: {str(e)}", "details": {"error": str(e), "error_type": type(e).__name__, "stage": "repository_access"}}


@router.get("/{repo_id}/debug/diagnostics")
def debug_diagnostics(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_repo_manager=Depends(get_git_repo_manager),
    git_auth_service=Depends(get_git_auth_service),
):
    """Get comprehensive diagnostic information for the repository."""
    try:
        service = GitDebugService(git_repo_manager, git_auth_service)
        return service.get_diagnostics(repo_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Debug diagnostics failed for repo %s: %s", repo_id, e)
        return {"success": False, "error": str(e), "error_type": type(e).__name__}
