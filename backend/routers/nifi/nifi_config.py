"""NiFi server and cluster configuration endpoints."""

import logging
from typing import List
from fastapi import APIRouter, Depends

from core.auth import require_permission
from models.nifi_server import NifiServerCreate, NifiServerUpdate, NifiServerResponse
from models.nifi_cluster import (
    NifiClusterCreate,
    NifiClusterUpdate,
    NifiClusterResponse,
    NifiClusterPrimaryResponse,
)
from services.nifi import nifi_config_service

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
