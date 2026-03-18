"""Git File History Service.

Encapsulates complete file history reconstruction logic for Git repositories.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from git import InvalidGitRepositoryError, GitCommandError

from services.settings.git.shared_utils import get_git_repo_by_id

logger = logging.getLogger(__name__)


class GitFileHistoryService:
    """Service for retrieving complete file history from Git repositories."""

    def get_complete_history(
        self,
        repo_id: int,
        file_path: str,
        from_commit: str = None,
        cache_service=None,
    ) -> dict:
        """Get the complete commit history for a file."""
        from services.settings.settings_service import SettingsService

        cache_cfg = SettingsService().get_cache_settings()
        repo = get_git_repo_by_id(repo_id)

        cache_key = f"repo:{repo_id}:filehistory:{from_commit or 'HEAD'}:{file_path}"
        if cache_service and cache_cfg.get("enabled", True):
            cached = cache_service.get(cache_key)
            if cached is not None:
                return cached

        start_commit = from_commit if from_commit else "HEAD"
        commits = list(repo.iter_commits(start_commit, paths=file_path))

        if not commits:
            commits = self._fallback_to_head_commits(repo, file_path)

        history_commits = []

        if from_commit:
            history_commits = self._prepend_context_commit(repo, from_commit, file_path, commits)

        history_commits.extend(self._build_history_entries(commits, file_path))

        result = {
            "file_path": file_path,
            "from_commit": start_commit,
            "total_commits": len(history_commits),
            "commits": history_commits,
        }

        if cache_service and cache_cfg.get("enabled", True):
            cache_service.set(cache_key, result, int(cache_cfg.get("ttl_seconds", 600)))

        return result

    def _fallback_to_head_commits(self, repo, file_path: str) -> list:
        """Try to find commits from HEAD when the specified start commit has none."""
        try:
            head_commit = repo.head.commit
            head_commit.tree[file_path]
            commits = list(repo.iter_commits("HEAD", paths=file_path))
            if not commits:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No commits found for file: {file_path}",
                )
            return commits
        except (KeyError, AttributeError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {file_path}",
            )

    def _prepend_context_commit(self, repo, from_commit: str, file_path: str, commits: list) -> list:
        """If from_commit didn't touch the file, add it as a context entry."""
        selected_found = any(
            c.hexsha == from_commit
            or c.hexsha.startswith(from_commit)
            or from_commit.startswith(c.hexsha)
            for c in commits
        )
        if selected_found:
            return []

        try:
            commit_obj = repo.commit(from_commit)
            try:
                commit_obj.tree[file_path]
                return [{
                    "hash": commit_obj.hexsha,
                    "short_hash": commit_obj.hexsha[:8],
                    "message": commit_obj.message.strip(),
                    "author": {
                        "name": commit_obj.author.name,
                        "email": commit_obj.author.email,
                    },
                    "date": commit_obj.committed_datetime.isoformat(),
                    "change_type": "N",
                }]
            except KeyError:
                return []
        except Exception:
            return []

    def _build_history_entries(self, commits: list, file_path: str) -> list:
        """Build history commit entries with change type classification."""
        entries = []
        for i, commit in enumerate(commits):
            if i == len(commits) - 1:
                change_type = "A"
            else:
                try:
                    commit.tree[file_path]
                    change_type = "M"
                except KeyError:
                    change_type = "D"

            entries.append({
                "hash": commit.hexsha,
                "short_hash": commit.hexsha[:8],
                "message": commit.message.strip(),
                "author": {
                    "name": commit.author.name,
                    "email": commit.author.email,
                },
                "date": commit.committed_datetime.isoformat(),
                "change_type": change_type,
            })
        return entries

    def get_last_commit(self, repo_id: int, file_path: str) -> dict:
        """Return the last commit that touched a file, plus current existence check.

        Args:
            repo_id: ID of the Git repository.
            file_path: Relative path of the file within the repository.

        Returns:
            Dict with keys: file_path, file_exists, last_commit (hash, short_hash,
            message, author, committer, date, timestamp).

        Raises:
            HTTPException 404 if no commits found for the file.
            HTTPException 500 on unexpected git errors.
        """
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
                "author": {
                    "name": last_commit.author.name,
                    "email": last_commit.author.email,
                },
                "committer": {
                    "name": last_commit.committer.name,
                    "email": last_commit.committer.email,
                },
                "date": last_commit.committed_datetime.isoformat(),
                "timestamp": int(last_commit.committed_datetime.timestamp()),
            },
        }

    def get_files_at_commit(
        self, repo_id: int, commit_hash: str, file_path: str | None = None
    ) -> list | dict:
        """Return files present at a specific commit, or content of a specific file.

        When *file_path* is provided the return value is a dict with keys
        file_path, content, commit.  Otherwise a sorted list of allowed-extension
        file paths is returned.

        Args:
            repo_id: ID of the Git repository.
            commit_hash: Full or abbreviated commit hash.
            file_path: Optional relative file path to read content for.

        Returns:
            List of file paths or dict (file_path, content, commit).

        Raises:
            HTTPException 404 if the file_path is not found in the commit tree.
            HTTPException 500 on unexpected errors.
        """
        from config import settings as _settings

        repo = get_git_repo_by_id(repo_id)
        commit = repo.commit(commit_hash)

        if file_path:
            try:
                file_content = (commit.tree / file_path).data_stream.read().decode("utf-8")
                return {
                    "file_path": file_path,
                    "content": file_content,
                    "commit": commit_hash[:8],
                }
            except KeyError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File '{file_path}' not found in commit {commit_hash[:8]}",
                )

        config_extensions = _settings.allowed_file_extensions
        files = [item.path for item in commit.tree.traverse() if item.type == "blob"]
        return sorted(f for f in files if any(f.endswith(ext) for ext in config_extensions))
