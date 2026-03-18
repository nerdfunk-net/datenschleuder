"""Git File Search Service.

Encapsulates file search and enumeration logic for Git repositories.
"""

from __future__ import annotations

import fnmatch
import logging
import os

from fastapi import HTTPException

from services.settings.git.paths import repo_path as git_repo_path

logger = logging.getLogger(__name__)


class GitFileSearchService:
    """Service for searching files within a Git repository."""

    def __init__(self, git_repo_manager):
        self.git_repo_manager = git_repo_manager

    def search(self, repo_id: int, query: str = "", limit: int = 50) -> dict:
        """Search files in a repository with optional filtering and pagination."""
        repository = self.git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo_path = str(git_repo_path(repository))

        if not os.path.exists(repo_path):
            return {
                "success": True,
                "data": {
                    "files": [],
                    "total_count": 0,
                    "filtered_count": 0,
                    "query": query,
                    "repository_name": repository["name"],
                },
            }

        structured_files = self._enumerate_files(repo_path)
        filtered_files = self._filter_files(structured_files, query)
        paginated = filtered_files[:limit]

        return {
            "success": True,
            "data": {
                "files": paginated,
                "total_count": len(structured_files),
                "filtered_count": len(filtered_files),
                "query": query,
                "repository_name": repository["name"],
                "has_more": len(filtered_files) > limit,
            },
        }

    def _enumerate_files(self, repo_path: str) -> list:
        """Walk the repository directory and collect file metadata."""
        structured_files = []
        for root, dirs, files in os.walk(repo_path):
            if ".git" in root:
                continue
            rel_root = os.path.relpath(root, repo_path)
            if rel_root == ".":
                rel_root = ""
            for file in files:
                if file.startswith("."):
                    continue
                full_path = os.path.join(rel_root, file) if rel_root else file
                abs_path = os.path.join(root, file)
                structured_files.append({
                    "name": file,
                    "path": full_path,
                    "directory": rel_root,
                    "size": os.path.getsize(abs_path) if os.path.exists(abs_path) else 0,
                })
        return structured_files

    def _filter_files(self, files: list, query: str) -> list:
        """Filter files by query and sort by relevance."""
        if not query:
            return sorted(files, key=lambda x: x["path"])

        query_lower = query.lower()
        matched = [
            f for f in files
            if (
                query_lower in f["name"].lower()
                or query_lower in f["path"].lower()
                or query_lower in f["directory"].lower()
                or fnmatch.fnmatch(f["name"].lower(), f"*{query_lower}*")
                or fnmatch.fnmatch(f["path"].lower(), f"*{query_lower}*")
            )
        ]

        def sort_key(item):
            name_lower = item["name"].lower()
            if name_lower == query_lower:
                return (0, item["path"])
            if name_lower.startswith(query_lower):
                return (1, item["path"])
            if query_lower in name_lower:
                return (2, item["path"])
            return (3, item["path"])

        matched.sort(key=sort_key)
        return matched
