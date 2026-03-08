"""Git integration helpers for cert-manager operations."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from services.settings.git.paths import repo_path
from services.settings.git.service import git_service

logger = logging.getLogger(__name__)


def _commit_file(repository: dict, abs_path: Path, operation: str) -> Optional[str]:
    """Stage and commit a single file to the git repository.

    Returns the commit SHA on success, or None if nothing to commit.
    """
    root = repo_path(repository)
    relative = abs_path.relative_to(root)
    commit_msg = f"cert-manager: {operation} → {relative}"

    try:
        result = git_service.commit_and_push(
            repository,
            message=commit_msg,
            files=[str(relative)],
        )
        return result.commit_sha if result.success else None
    except Exception as exc:
        logger.warning("Git commit failed for %s: %s", relative, exc)
        return None
