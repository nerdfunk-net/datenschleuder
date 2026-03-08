"""NiFi server and cluster configuration endpoints."""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.nifi_server import NifiServerCreate, NifiServerUpdate, NifiServerResponse
from models.nifi_cluster import (
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
async def list_servers(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all NiFi servers."""
    return nifi_config_service.list_servers()


@router.post(
    "/servers/",
    response_model=NifiServerResponse,
    status_code=201,
)
async def create_server(
    data: NifiServerCreate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Create a new NiFi server."""
    return nifi_config_service.create_server(data)


@router.put("/servers/{server_id}", response_model=NifiServerResponse)
async def update_server(
    server_id: int,
    data: NifiServerUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Update a NiFi server."""
    return nifi_config_service.update_server(server_id, data)


@router.delete("/servers/{server_id}")
async def delete_server(
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
async def list_clusters(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """List all NiFi clusters with their members."""
    return nifi_config_service.list_clusters()


@router.post(
    "/clusters/",
    response_model=NifiClusterResponse,
    status_code=201,
)
async def create_cluster(
    data: NifiClusterCreate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Create a new NiFi cluster."""
    return nifi_config_service.create_cluster(data)


@router.get("/clusters/{cluster_id}/get-primary", response_model=NifiClusterPrimaryResponse)
async def get_cluster_primary_instance(
    cluster_id: int,
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Return the primary NiFi instance for a cluster.

    The primary instance is used by all applications to communicate with the cluster.
    """
    return nifi_config_service.get_primary_instance(cluster_id)


@router.put("/clusters/{cluster_id}", response_model=NifiClusterResponse)
async def update_cluster(
    cluster_id: int,
    data: NifiClusterUpdate,
    current_user: dict = Depends(require_permission("nifi", "write")),
):
    """Update a NiFi cluster."""
    return nifi_config_service.update_cluster(cluster_id, data)


@router.delete("/clusters/{cluster_id}")
async def delete_cluster(
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
