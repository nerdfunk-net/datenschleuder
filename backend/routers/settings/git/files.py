"""
Git file operations router - File-specific operations like listing, search, and history.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from git import InvalidGitRepositoryError, GitCommandError

from core.auth import require_permission
from dependencies import get_cache_service, get_git_repo_manager, get_git_service
from models.files import WriteFileRequest
from services.settings.git.directory_service import GitDirectoryService
from services.settings.git.file_history_service import GitFileHistoryService
from services.settings.git.file_operations_service import GitFileOperationsService
from services.settings.git.file_search_service import GitFileSearchService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git/{repo_id}", tags=["git-files"])


@router.get("/files/search")
def search_repository_files(
    repo_id: int,
    query: str = "",
    limit: int = 50,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Search for files in a specific Git repository with filtering and pagination."""
    try:
        service = GitFileSearchService(git_repo_manager)
        return service.search(repo_id, query, limit)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error searching repository files: %s", e)
        return {"success": False, "message": f"File search failed: {str(e)}"}


@router.get("/files/{commit_hash}/commit")
def get_files(
    repo_id: int,
    commit_hash: str,
    file_path: str = None,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Get list of files in a specific commit or file content if file_path is provided."""
    try:
        return GitFileHistoryService().get_files_at_commit(
            repo_id, commit_hash, file_path
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get files: {str(e)}",
        )


@router.get("/files/{file_path:path}/history")
def get_file_history(
    repo_id: int,
    file_path: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Get the last change information for a specific file."""
    try:
        return GitFileHistoryService().get_last_commit(repo_id, file_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file history: {str(e)}",
        )


@router.get("/files/{file_path:path}/complete-history")
def get_file_complete_history(
    repo_id: int,
    file_path: str,
    from_commit: str = None,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    cache_service=Depends(get_cache_service),
):
    """Get the complete history of a file from a specific commit backwards to its creation."""
    try:
        service = GitFileHistoryService()
        return service.get_complete_history(
            repo_id, file_path, from_commit, cache_service
        )
    except (InvalidGitRepositoryError, GitCommandError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository not found or commit not found: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git file complete history error: {str(e)}",
        )


@router.get("/file-content")
def get_file_content(
    repo_id: int,
    path: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Read the content of a file from a Git repository."""
    try:
        content = GitFileOperationsService().read_file_content(
            repo_id, path, git_repo_manager
        )
        logger.info(
            "User %s read file %s from repository %d",
            current_user.get("username"),
            path,
            repo_id,
        )
        return PlainTextResponse(content=content)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error reading file content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading file content: {str(e)}",
        )


@router.put("/file-content")
def write_file_content(
    repo_id: int,
    request: WriteFileRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
    git_repo_manager=Depends(get_git_repo_manager),
    git_service=Depends(get_git_service),
):
    """Write content to a file in a Git repository, commit and push."""
    try:
        result = GitFileOperationsService().write_file_content(
            repo_id=repo_id,
            path=request.path,
            content=request.content,
            commit_message=request.commit_message,
            git_repo_manager=git_repo_manager,
            git_service=git_service,
        )
        logger.info(
            "User %s wrote file %s in repository %d: %s",
            current_user.get("username"),
            request.path,
            repo_id,
            result.get("message"),
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error writing file content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error writing file content: {str(e)}",
        )


@router.get("/file-content-parsed")
def get_file_content_parsed(
    repo_id: int,
    path: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Read a YAML file from a Git repository and return parsed JSON."""
    try:
        result = GitFileOperationsService().read_file_content_parsed(
            repo_id, path, git_repo_manager
        )
        logger.info(
            "User %s parsed YAML file %s from repository %d",
            current_user.get("username"),
            path,
            repo_id,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error parsing YAML file content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error parsing file content: {str(e)}",
        )


@router.get("/tree")
def get_directory_tree(
    repo_id: int,
    path: str = "",
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Get hierarchical directory structure of a Git repository."""
    try:
        service = GitDirectoryService(git_repo_manager)
        return service.get_directory_tree(repo_id, path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error building directory tree: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building directory tree: {str(e)}",
        )


@router.get("/directory")
def get_directory_files(
    repo_id: int,
    path: str = "",
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_repo_manager=Depends(get_git_repo_manager),
):
    """Get files in a specific directory with last commit metadata."""
    try:
        service = GitDirectoryService(git_repo_manager)
        return service.list_directory(repo_id, path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing directory files: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing directory files: {str(e)}",
        )
