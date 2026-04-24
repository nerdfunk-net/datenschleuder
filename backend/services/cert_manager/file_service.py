"""
Certificate file discovery service.

Walks the git repository associated with a NiFi instance to find
*.pem and *.p12 certificate files.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List

from fastapi import HTTPException, status

from services.settings.git_repository_service import (
    GitRepositoryService as GitRepositoryManager,
)
from repositories.nifi.nifi_instance_repository import NifiInstanceRepository
from services.settings.git.paths import repo_path
from models.cert_manager import CertFileInfo, NifiPasswordEntry

logger = logging.getLogger(__name__)

_git_repo_manager = GitRepositoryManager()
_nifi_repo = NifiInstanceRepository()

CERT_EXTENSIONS = {".pem", ".p12"}

NIFI_PASSWORD_KEYS = {
    "nifi.security.keystorePasswd",
    "nifi.security.keyPasswd",
    "nifi.security.truststorePasswd",
}


def list_cert_files(instance_id: int) -> List[CertFileInfo]:
    """Return all *.pem and *.p12 files in the git repo linked to a NiFi instance.

    Args:
        instance_id: Primary key of the NiFi instance.

    Returns:
        List of CertFileInfo objects, paths relative to the repo root.

    Raises:
        HTTPException 404 if the instance does not exist.
        HTTPException 400 if the instance has no git repo configured.
        HTTPException 500 on git errors.
    """
    # 1. Resolve NiFi instance
    instance = _nifi_repo.get_by_id(instance_id)
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NiFi instance {instance_id} not found.",
        )

    git_repo_id = instance.git_config_repo_id
    if git_repo_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This NiFi instance does not have a git repository configured.",
        )

    # 2. Fetch repository metadata
    repository = _git_repo_manager.get_repository(git_repo_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository {git_repo_id} not found.",
        )

    if not repository.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Git repository '{repository['name']}' is inactive.",
        )

    # 3. Ensure local clone is up to date
    try:
        from services.settings.git.service import GitService

        GitService().open_or_clone(repository)
    except Exception as exc:
        logger.error("Failed to open/clone git repository %s: %s", git_repo_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to open git repository: {exc}",
        ) from exc

    # 4. Walk the repository directory for cert files
    root: Path = repo_path(repository)
    files: List[CertFileInfo] = []

    if not root.exists():
        logger.warning("Repository path does not exist: %s", root)
        return files

    for cert_path in sorted(root.rglob("*")):
        if cert_path.is_file() and cert_path.suffix.lower() in CERT_EXTENSIONS:
            relative = cert_path.relative_to(root)
            files.append(
                CertFileInfo(
                    path=str(relative),
                    name=cert_path.name,
                    file_type=cert_path.suffix.lstrip(".").lower(),
                    size=cert_path.stat().st_size,
                )
            )

    return files


def resolve_cert_file_path(instance_id: int, file_path: str) -> Path:
    """Resolve a relative cert file path to an absolute filesystem path.

    Validates that the resolved path stays within the repository root
    (prevents directory traversal attacks).

    Args:
        instance_id: Primary key of the NiFi instance.
        file_path: Relative path within the repo (e.g. "certs/keystore.p12").

    Returns:
        Absolute Path to the file.

    Raises:
        HTTPException on validation errors or missing resources.
    """
    instance = _nifi_repo.get_by_id(instance_id)
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NiFi instance {instance_id} not found.",
        )

    git_repo_id = instance.git_config_repo_id
    if git_repo_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This NiFi instance does not have a git repository configured.",
        )

    repository = _git_repo_manager.get_repository(git_repo_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository {git_repo_id} not found.",
        )

    root: Path = repo_path(repository)
    resolved = (root / file_path).resolve()

    # Prevent directory traversal
    try:
        resolved.relative_to(root.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path.",
        ) from exc

    if not resolved.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_path}",
        )

    return resolved


def get_nifi_passwords(instance_id: int, file_path: str) -> list[NifiPasswordEntry]:
    """Look for nifi.properties in the same directory as the given file.

    Parses it for the three NiFi security password keys and returns any found.
    Returns an empty list if nifi.properties does not exist or has no matching keys.
    """
    abs_path = resolve_cert_file_path(instance_id, file_path)
    nifi_props = abs_path.parent / "nifi.properties"
    if not nifi_props.exists():
        return []

    entries: list[NifiPasswordEntry] = []
    try:
        content = nifi_props.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.warning("Could not read nifi.properties at %s: %s", nifi_props, exc)
        return []

    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        value = value.strip()
        if key in NIFI_PASSWORD_KEYS and value:
            entries.append(NifiPasswordEntry(key=key, value=value))

    return entries


def get_repository_for_instance(instance_id: int):
    """Return the repository dict for the NiFi instance's git config repo.

    Raises:
        HTTPException on missing instance or unconfigured repo.
    """
    instance = _nifi_repo.get_by_id(instance_id)
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NiFi instance {instance_id} not found.",
        )

    git_repo_id = instance.git_config_repo_id
    if git_repo_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This NiFi instance does not have a git repository configured.",
        )

    repository = _git_repo_manager.get_repository(git_repo_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository {git_repo_id} not found.",
        )

    return repository
