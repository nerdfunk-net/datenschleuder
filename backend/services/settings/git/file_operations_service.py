"""Git File Operations Service.

Encapsulates file read/write operations on Git repository filesystem paths,
including path safety validation, content reading, YAML parsing, and file writing.
"""

from __future__ import annotations

import logging
import os

import yaml
from fastapi import HTTPException, status

from services.settings.git.paths import repo_path as git_repo_path

logger = logging.getLogger(__name__)


def resolve_safe_file_path(repo_path: str, path: str) -> str:
    """Resolve and validate that path refers to a file within repo_path.

    Raises HTTPException on any path traversal attempt, missing repo/file, or
    non-file paths.  Returns the resolved absolute path as a string.
    """
    if not os.path.exists(repo_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository directory not found: {repo_path}",
        )
    file_path = os.path.join(repo_path, path)
    file_path_resolved = os.path.realpath(file_path)
    repo_path_resolved = os.path.realpath(repo_path)
    if (
        not file_path_resolved.startswith(repo_path_resolved + os.sep)
        and file_path_resolved != repo_path_resolved
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: file path is outside repository",
        )
    if not os.path.exists(file_path_resolved):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {path}",
        )
    if not os.path.isfile(file_path_resolved):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}",
        )
    return file_path_resolved


class GitFileOperationsService:
    """Service for reading and writing files within Git repository working trees."""

    def read_file_content(self, repo_id: int, path: str, git_repo_manager) -> str:
        """Read a file from the repository working tree and return its content.

        Args:
            repo_id: ID of the Git repository.
            path: Relative file path within the repository.
            git_repo_manager: Repository manager instance (injected via FastAPI).

        Returns:
            File content as a string.

        Raises:
            HTTPException: On repository/file not found or encoding errors.
        """
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found"
            )

        repo_path = str(git_repo_path(repository))
        file_path_resolved = resolve_safe_file_path(repo_path, path)

        try:
            with open(file_path_resolved, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File is not a text file: {path}",
            )

    def read_file_content_parsed(
        self, repo_id: int, path: str, git_repo_manager
    ) -> dict:
        """Read a YAML file from the repository working tree and return parsed data.

        Args:
            repo_id: ID of the Git repository.
            path: Relative file path within the repository.
            git_repo_manager: Repository manager instance (injected via FastAPI).

        Returns:
            Dict with keys: parsed (YAML content as dict/list), file_path.

        Raises:
            HTTPException: On repository/file not found, encoding errors, or YAML errors.
        """
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found"
            )

        repo_path = str(git_repo_path(repository))
        file_path_resolved = resolve_safe_file_path(repo_path, path)

        try:
            with open(file_path_resolved, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File is not a text file: {path}",
            )

        try:
            parsed = yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"YAML parse error: {e}",
            )

        return {"parsed": parsed, "file_path": path}

    def write_file_content(
        self,
        repo_id: int,
        path: str,
        content: str,
        commit_message: str,
        git_repo_manager,
        git_service,
    ) -> dict:
        """Write content to a file in the repository, then commit and push.

        Args:
            repo_id: ID of the Git repository.
            path: Relative file path within the repository.
            content: New file content.
            commit_message: Git commit message.
            git_repo_manager: Repository manager instance (injected via FastAPI).
            git_service: Git service instance for fetch/reset and commit/push.

        Returns:
            Dict with keys: success, message, commit_sha, files_changed, pushed, branch.

        Raises:
            HTTPException: On repository not found or path traversal.
        """
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found"
            )

        repo_path = str(git_repo_path(repository))
        if not os.path.exists(repo_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository directory not found",
            )

        file_path = os.path.join(repo_path, path)
        file_path_resolved = os.path.realpath(file_path)
        repo_path_resolved = os.path.realpath(repo_path)
        if (
            not file_path_resolved.startswith(repo_path_resolved + os.sep)
            and file_path_resolved != repo_path_resolved
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: file path is outside repository",
            )

        git_service.fetch_and_reset(repository)
        os.makedirs(os.path.dirname(file_path_resolved), exist_ok=True)

        with open(file_path_resolved, "w", encoding="utf-8") as f:
            f.write(content)

        result = git_service.commit_and_push(
            repository=repository,
            message=commit_message,
            files=[path],
        )

        return {
            "success": result.success,
            "message": result.message,
            "commit_sha": result.commit_sha,
            "files_changed": result.files_changed,
            "pushed": result.pushed,
            "branch": result.branch,
        }
