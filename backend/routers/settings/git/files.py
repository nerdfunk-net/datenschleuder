"""
Git file operations router - File-specific operations like listing, search, and history.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from git import InvalidGitRepositoryError, GitCommandError
from pydantic import BaseModel

from core.auth import require_permission
from dependencies import get_cache_service, get_git_repo_manager, get_git_service
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
        return GitFileHistoryService().get_files_at_commit(repo_id, commit_hash, file_path)
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
        return service.get_complete_history(repo_id, file_path, from_commit, cache_service)
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
        content = GitFileOperationsService().read_file_content(repo_id, path, git_repo_manager)
        logger.info(
            "User %s read file %s from repository %d",
            current_user.get("username"), path, repo_id,
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


class WriteFileRequest(BaseModel):
    """Request body for writing a file to a Git repository."""
    path: str
    content: str
    commit_message: str


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
            current_user.get("username"), request.path, repo_id, result.get("message"),
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
        result = GitFileOperationsService().read_file_content_parsed(repo_id, path, git_repo_manager)
        logger.info(
            "User %s parsed YAML file %s from repository %d",
            current_user.get("username"), path, repo_id,
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
        repo = get_git_repo_by_id(repo_id)
        commit = repo.commit(commit_hash)

        if file_path:
            try:
                file_content = (commit.tree / file_path).data_stream.read().decode("utf-8")
                return {"file_path": file_path, "content": file_content, "commit": commit_hash[:8]}
            except KeyError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File '{file_path}' not found in commit {commit_hash[:8]}",
                )

        files = [item.path for item in commit.tree.traverse() if item.type == "blob"]
        from config import settings
        config_extensions = settings.allowed_file_extensions
        return sorted(f for f in files if any(f.endswith(ext) for ext in config_extensions))
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
        repo = get_git_repo_by_id(repo_id)
        commits = list(repo.iter_commits(paths=file_path, max_count=1))

        if not commits:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No commits found for file: {file_path}",
            )

        last_commit = commits[0]
        try:
            (last_commit.tree / file_path).data_stream.read().decode("utf-8")
            file_exists = True
        except (KeyError, AttributeError, UnicodeDecodeError, OSError):
            file_exists = False

        return {
            "file_path": file_path,
            "file_exists": file_exists,
            "last_commit": {
                "hash": last_commit.hexsha,
                "short_hash": last_commit.hexsha[:8],
                "message": last_commit.message.strip(),
                "author": {"name": last_commit.author.name, "email": last_commit.author.email},
                "committer": {"name": last_commit.committer.name, "email": last_commit.committer.email},
                "date": last_commit.committed_datetime.isoformat(),
                "timestamp": int(last_commit.committed_datetime.timestamp()),
            },
        }
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
        return service.get_complete_history(repo_id, file_path, from_commit, cache_service)
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
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo_path = str(git_repo_path(repository))
        file_path_resolved = _resolve_safe_file_path(repo_path, path)

        try:
            with open(file_path_resolved, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail=f"File is not a text file: {path}")

        logger.info(
            "User %s read file %s from repository %s",
            current_user.get("username"), path, repository["name"],
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


class WriteFileRequest(BaseModel):
    """Request body for writing a file to a Git repository."""
    path: str
    content: str
    commit_message: str


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
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo_path = str(git_repo_path(repository))
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository directory not found")

        file_path = os.path.join(repo_path, request.path)
        file_path_resolved = os.path.realpath(file_path)
        repo_path_resolved = os.path.realpath(repo_path)
        if not file_path_resolved.startswith(repo_path_resolved):
            raise HTTPException(status_code=403, detail="Access denied: file path is outside repository")

        git_service.fetch_and_reset(repository)
        os.makedirs(os.path.dirname(file_path_resolved), exist_ok=True)

        with open(file_path_resolved, "w", encoding="utf-8") as f:
            f.write(request.content)

        result = git_service.commit_and_push(
            repository=repository,
            message=request.commit_message,
            files=[request.path],
        )

        logger.info(
            "User %s wrote file %s in repository %s: %s",
            current_user.get("username"), request.path, repository["name"], result.message,
        )

        return {
            "success": result.success,
            "message": result.message,
            "commit_sha": result.commit_sha,
            "files_changed": result.files_changed,
            "pushed": result.pushed,
            "branch": result.branch,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error writing file content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error writing file content: %s" % str(e),
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
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo_path = str(git_repo_path(repository))
        file_path_resolved = _resolve_safe_file_path(repo_path, path)

        try:
            with open(file_path_resolved, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File is not a text file: %s" % path)

        try:
            parsed = yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise HTTPException(status_code=400, detail="YAML parse error: %s" % str(e))

        logger.info(
            "User %s parsed YAML file %s from repository %s",
            current_user.get("username"), path, repository["name"],
        )
        return {"parsed": parsed, "file_path": path}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error parsing YAML file content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error parsing file content: %s" % str(e),
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
