"""Git Directory Service.

Encapsulates directory tree building and directory listing logic for Git repositories.
"""

from __future__ import annotations

import logging
import os

from fastapi import HTTPException

from services.settings.git.paths import repo_path as git_repo_path
from services.settings.git.shared_utils import get_git_repo_by_id

logger = logging.getLogger(__name__)


class GitDirectoryService:
    """Service for directory listing and tree operations in Git repositories."""

    def __init__(self, git_repo_manager):
        self.git_repo_manager = git_repo_manager

    def get_directory_tree(self, repo_id: int, path: str = "") -> dict:
        """Get hierarchical directory structure of a Git repository."""
        repository = self.git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo_path = str(git_repo_path(repository))

        if not os.path.exists(repo_path):
            return {
                "name": "root",
                "path": "",
                "type": "directory",
                "children": [],
                "repository_name": repository["name"],
            }

        target_path, repo_path_resolved = self._resolve_safe_path(repo_path, path)

        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")
        if not os.path.isdir(target_path):
            raise HTTPException(
                status_code=400, detail=f"Path is not a directory: {path}"
            )

        tree = self._build_tree(target_path, path)
        if tree is None:
            raise HTTPException(
                status_code=403, detail="Permission denied accessing directory"
            )

        tree["repository_name"] = repository["name"]
        return tree

    def list_directory(self, repo_id: int, path: str = "") -> dict:
        """Get files in a specific directory with last commit metadata."""
        repository = self.git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo = get_git_repo_by_id(repo_id)
        repo_path = str(git_repo_path(repository))

        if not os.path.exists(repo_path):
            return {"path": path, "files": [], "directory_exists": False}

        target_path, _ = self._resolve_safe_path(repo_path, path)

        if not os.path.exists(target_path):
            return {"path": path, "files": [], "directory_exists": False}
        if not os.path.isdir(target_path):
            raise HTTPException(
                status_code=400, detail=f"Path is not a directory: {path}"
            )

        try:
            items = os.listdir(target_path)
        except PermissionError:
            raise HTTPException(
                status_code=403, detail="Permission denied accessing directory"
            )

        files_data = []
        for item in items:
            if item.startswith("."):
                continue
            item_path = os.path.join(target_path, item)
            if not os.path.isfile(item_path):
                continue

            file_rel_path = os.path.join(path, item) if path else item
            files_data.append(
                {
                    "name": item,
                    "path": file_rel_path,
                    "size": os.path.getsize(item_path),
                    "last_commit": self._get_file_commit_info(repo, file_rel_path),
                }
            )

        files_data.sort(key=lambda x: x["name"].lower())
        return {"path": path, "files": files_data, "directory_exists": True}

    def _resolve_safe_path(self, repo_path: str, sub_path: str) -> tuple[str, str]:
        """Resolve and validate that sub_path is within repo_path."""
        repo_path_resolved = os.path.realpath(repo_path)
        target = os.path.join(repo_path, sub_path) if sub_path else repo_path
        target_resolved = os.path.realpath(target)
        if not target_resolved.startswith(repo_path_resolved):
            raise HTTPException(
                status_code=403, detail="Access denied: path is outside repository"
            )
        return target_resolved, repo_path_resolved

    def _build_tree(self, dir_path: str, rel_path: str = "") -> dict:
        """Recursively build directory tree structure."""
        try:
            items = os.listdir(dir_path)
        except PermissionError:
            logger.warning("Permission denied accessing directory: %s", dir_path)
            return None

        dirs = []
        files = []
        for item in items:
            if item.startswith("."):
                continue
            item_path = os.path.join(dir_path, item)
            item_rel_path = os.path.join(rel_path, item) if rel_path else item
            if os.path.isdir(item_path):
                dirs.append((item, item_path, item_rel_path))
            elif os.path.isfile(item_path):
                files.append(item)

        dirs.sort(key=lambda x: x[0].lower())
        children = []
        for dir_name, dir_full_path, dir_rel_path in dirs:
            subtree = self._build_tree(dir_full_path, dir_rel_path)
            if subtree is not None:
                children.append(subtree)

        node_name = os.path.basename(dir_path) if rel_path else "root"
        return {
            "name": node_name,
            "path": rel_path,
            "type": "directory",
            "file_count": len(files),
            "children": children,
        }

    def _get_file_commit_info(self, repo, file_rel_path: str) -> dict:
        """Get last commit info for a file, returning empty info on failure."""
        try:
            commits = list(repo.iter_commits(paths=file_rel_path, max_count=1))
            if commits:
                last_commit = commits[0]
                return {
                    "hash": last_commit.hexsha,
                    "short_hash": last_commit.hexsha[:8],
                    "message": last_commit.message.strip(),
                    "author": {
                        "name": last_commit.author.name,
                        "email": last_commit.author.email,
                    },
                    "date": last_commit.committed_datetime.isoformat(),
                    "timestamp": int(last_commit.committed_datetime.timestamp()),
                }
        except Exception as e:
            logger.warning("Failed to get commit info for %s: %s", file_rel_path, e)

        return {
            "hash": "",
            "short_hash": "",
            "message": "No commit history",
            "author": {"name": "", "email": ""},
            "date": "",
            "timestamp": 0,
        }
