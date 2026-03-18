"""NiFi server and cluster configuration endpoints."""

import logging
import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse

from dependencies import get_git_repo_manager, get_git_service
from services.settings.git.paths import repo_path as git_repo_path

from core.auth import require_permission
from models.nifi import (
    NifiServerCreate,
    NifiServerUpdate,
    NifiServerResponse,
    NifiClusterCreate,
    NifiClusterUpdate,
    NifiClusterResponse,
    NifiClusterPrimaryResponse,
)
from services.nifi import nifi_config_service
from services.nifi.nifi_context import with_nifi_instance
from services.nifi.operations import process_groups as pg_ops
from repositories.nifi.nifi_cluster_repository import NifiClusterRepository

_cluster_repo = NifiClusterRepository()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi", tags=["nifi-config"])


# ---------------------------------------------------------------------------
# Server endpoints
# ---------------------------------------------------------------------------


@router.get("/servers/", response_model=List[NifiServerResponse])
def list_servers(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all NiFi servers."""
    return nifi_config_service.list_servers()


@router.post(
    "/servers/",
    response_model=NifiServerResponse,
    status_code=201,
)
def create_server(
    data: NifiServerCreate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Create a new NiFi server."""
    return nifi_config_service.create_server(data)


@router.put("/servers/{server_id}", response_model=NifiServerResponse)
def update_server(
    server_id: int,
    data: NifiServerUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Update a NiFi server."""
    return nifi_config_service.update_server(server_id, data)


@router.delete("/servers/{server_id}")
def delete_server(
    server_id: int,
    current_user: dict = Depends(require_permission("nifi", "delete")),
):
    """Delete a NiFi server."""
    nifi_config_service.delete_server(server_id)
    return {"message": "NiFi server deleted successfully"}


# ---------------------------------------------------------------------------
# Cluster endpoints
# ---------------------------------------------------------------------------


@router.get("/clusters/", response_model=List[NifiClusterResponse])
def list_clusters(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all NiFi clusters with their members."""
    return nifi_config_service.list_clusters()


@router.post(
    "/clusters/",
    response_model=NifiClusterResponse,
    status_code=201,
)
def create_cluster(
    data: NifiClusterCreate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Create a new NiFi cluster."""
    return nifi_config_service.create_cluster(data)


@router.get(
    "/clusters/{cluster_id}/get-primary", response_model=NifiClusterPrimaryResponse
)
def get_cluster_primary_instance(
    cluster_id: int,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Return the primary NiFi instance for a cluster.

    The primary instance is used by all applications to communicate with the cluster.
    """
    return nifi_config_service.get_primary_instance(cluster_id)


@router.put("/clusters/{cluster_id}", response_model=NifiClusterResponse)
def update_cluster(
    cluster_id: int,
    data: NifiClusterUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Update a NiFi cluster."""
    return nifi_config_service.update_cluster(cluster_id, data)


@router.delete("/clusters/{cluster_id}")
def delete_cluster(
    cluster_id: int,
    current_user: dict = Depends(require_permission("nifi", "delete")),
):
    """Delete a NiFi cluster."""
    nifi_config_service.delete_cluster(cluster_id)
    return {"message": "NiFi cluster deleted successfully"}


@router.get("/clusters/{cluster_id}/ops/process-groups/all-paths")
async def get_cluster_process_group_paths(
    cluster_id: int,
    start_pg_id: str = "root",
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Get all process groups for a cluster's primary NiFi instance.

    Resolves the primary instance for the cluster and delegates to the
    standard process-group path enumeration.
    """
    # Validate cluster exists (raises 404 if not)
    nifi_config_service.get_primary_instance(cluster_id)

    # Get raw ORM instance for connection configuration
    primary_instance = _cluster_repo.get_primary_instance(cluster_id)
    if not primary_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No primary instance configured for cluster id %d" % cluster_id,
        )

    try:
        result = await with_nifi_instance(
            primary_instance,
            lambda: pg_ops.get_all_process_group_paths(start_pg_id),
        )
    except Exception as exc:
        logger.error(
            "Failed to fetch process groups for cluster %d via primary instance %d: %s",
            cluster_id,
            primary_instance.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to connect to NiFi cluster primary instance: %s" % str(exc),
        )

    pgs = result["process_groups"]
    return {
        "status": "success",
        "process_groups": pgs,
        "count": len(pgs),
        "root_id": result["root_id"],
    }


# ---------------------------------------------------------------------------
# Static NiFi config files (copied to repo on first deploy if missing)
# ---------------------------------------------------------------------------

_STATIC_FILES = [
    "logback.xml",
    "login-identity-providers.xml",
    "state-management.xml",
]


@router.post("/repos/{repo_id}/ensure-static-files")
def ensure_static_nifi_files(
    repo_id: int,
    current_user: dict = Depends(require_permission("nifi", "write")),
    git_repo_manager=Depends(get_git_repo_manager),
    git_service=Depends(get_git_service),
):
    """Copy missing static NiFi config files into a git repository.

    Checks for logback.xml, login-identity-providers.xml, and
    state-management.xml. Any file absent from the repository is copied from
    the contributing-data/nifi/ template directory, then all additions are
    committed and pushed in a single commit.

    Returns a list of files that were copied (empty list if all were present).
    """
    repository = git_repo_manager.get_repository(repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found"
        )

    repo_dir = git_repo_path(repository)
    if not os.path.exists(repo_dir):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository directory not found",
        )

    copied: list[str] = []

    try:
        # Sync to remote before checking/writing
        git_service.fetch_and_reset(repository)

        for filename in _STATIC_FILES:
            dest = os.path.join(repo_dir, filename)
            if os.path.exists(dest):
                continue  # already present — nothing to do

            src = os.path.normpath(
                os.path.join(_PROJECT_ROOT, "contributing-data", "nifi", filename)
            )
            if not os.path.isfile(src):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Template file not found on server: %s" % filename,
                )

            shutil.copy2(src, dest)
            copied.append(filename)
            logger.info(
                "Copied static NiFi file %s to repository %s",
                filename,
                repository.get("name"),
            )

        if copied:
            result = git_service.commit_and_push(
                repository=repository,
                message="[Wizard] Add missing static NiFi config files: %s"
                % ", ".join(copied),
                files=copied,
            )
            if not result.success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to commit static files: %s" % result.message,
                )

        return {"copied": copied}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("ensure_static_nifi_files failed for repo %d: %s", repo_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error ensuring static files: %s" % str(exc),
        )


# ---------------------------------------------------------------------------
# Fresh nifi.properties template
# ---------------------------------------------------------------------------

# Resolve path relative to this file: backend/routers/nifi/ → project root
_PROJECT_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")
)
_FRESH_PROPERTIES_PATH = os.path.join(
    _PROJECT_ROOT, "contributing-data", "nifi", "nifi.properties"
)


@router.get("/get-fresh-properties", response_class=PlainTextResponse)
def get_fresh_nifi_properties(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Return the default nifi.properties template from contributing-data.

    Used by the Cluster Wizard when the git repository does not yet contain a
    nifi.properties file (fresh cluster deployment).
    """
    if not os.path.isfile(_FRESH_PROPERTIES_PATH):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fresh nifi.properties template not found on server",
        )
    with open(_FRESH_PROPERTIES_PATH, "r", encoding="utf-8") as fh:
        return fh.read()
