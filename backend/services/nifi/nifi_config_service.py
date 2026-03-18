"""Service for NiFi server and cluster configuration management."""

import logging
from typing import List, Optional
from fastapi import HTTPException, status

from repositories.nifi.nifi_server_repository import NifiServerRepository
from repositories.nifi.nifi_cluster_repository import NifiClusterRepository
from repositories.nifi.nifi_instance_repository import NifiInstanceRepository
from repositories.settings.credentials_repository import CredentialsRepository
from models.nifi import (
    NifiServerCreate,
    NifiServerUpdate,
    NifiServerResponse,
    NifiInstanceResponse,
    NifiClusterCreate,
    NifiClusterUpdate,
    NifiClusterMemberResponse,
    NifiClusterResponse,
    NifiClusterPrimaryResponse,
)

logger = logging.getLogger(__name__)

_VALID_SSH_TYPES = {"ssh", "ssh_key"}

server_repo = NifiServerRepository()
cluster_repo = NifiClusterRepository()
instance_repo = NifiInstanceRepository()
cred_repo = CredentialsRepository()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_credential_name(credential_id: Optional[int]) -> Optional[str]:
    if credential_id is None:
        return None
    cred = cred_repo.get_by_id(credential_id)
    return cred.name if cred else None


def _server_to_response(server) -> NifiServerResponse:
    return NifiServerResponse(
        id=server.id,
        server_id=server.server_id,
        hostname=server.hostname,
        credential_id=server.credential_id,
        credential_name=_resolve_credential_name(server.credential_id),
        installation_type=server.installation_type or "bare",
        created_at=server.created_at,
        updated_at=server.updated_at,
    )


def _cluster_to_response(cluster) -> NifiClusterResponse:
    members = [
        NifiClusterMemberResponse(
            instance_id=m.instance.id,
            name=m.instance.name,
            nifi_url=m.instance.nifi_url,
            is_primary=m.is_primary,
        )
        for m in cluster.members
    ]
    return NifiClusterResponse(
        id=cluster.id,
        cluster_id=cluster.cluster_id,
        hierarchy_attribute=cluster.hierarchy_attribute,
        hierarchy_value=cluster.hierarchy_value,
        members=members,
        created_at=cluster.created_at,
        updated_at=cluster.updated_at,
    )


def _instance_to_response(inst) -> NifiInstanceResponse:
    return NifiInstanceResponse(
        id=inst.id,
        name=inst.name,
        hierarchy_attribute=inst.hierarchy_attribute,
        hierarchy_value=inst.hierarchy_value,
        server_id=inst.server_id,
        nifi_url=inst.nifi_url,
        username=inst.username,
        use_ssl=inst.use_ssl,
        verify_ssl=inst.verify_ssl,
        certificate_name=inst.certificate_name,
        check_hostname=inst.check_hostname,
        oidc_provider_id=inst.oidc_provider_id,
        created_at=inst.created_at,
        updated_at=inst.updated_at,
    )


def _validate_credential(credential_id: int) -> None:
    cred = cred_repo.get_by_id(credential_id)
    if not cred:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credential with id %d not found" % credential_id,
        )
    if cred.type not in _VALID_SSH_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credential must be of type 'ssh' or 'ssh_key', got '%s'"
            % cred.type,
        )


# ---------------------------------------------------------------------------
# Server CRUD
# ---------------------------------------------------------------------------


def list_servers() -> List[NifiServerResponse]:
    """Return all NiFi servers ordered by server_id."""
    servers = server_repo.get_all_ordered()
    return [_server_to_response(s) for s in servers]


def create_server(data: NifiServerCreate) -> NifiServerResponse:
    """Create a new NiFi server."""
    existing = server_repo.get_by_server_id(data.server_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Server with server_id '%s' already exists" % data.server_id,
        )
    if data.credential_id is not None:
        _validate_credential(data.credential_id)

    server = server_repo.create(
        server_id=data.server_id,
        hostname=data.hostname,
        credential_id=data.credential_id,
        installation_type=data.installation_type,
    )
    logger.info("Created NiFi server server_id=%s id=%d", server.server_id, server.id)
    return _server_to_response(server)


def update_server(server_db_id: int, data: NifiServerUpdate) -> NifiServerResponse:
    """Update an existing NiFi server."""
    server = server_repo.get_by_id(server_db_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi server with id %d not found" % server_db_id,
        )

    update_kwargs = data.model_dump(exclude_unset=True)

    if "server_id" in update_kwargs and update_kwargs["server_id"] != server.server_id:
        conflict = server_repo.get_by_server_id(update_kwargs["server_id"])
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Server with server_id '%s' already exists"
                % update_kwargs["server_id"],
            )

    if "credential_id" in update_kwargs and update_kwargs["credential_id"] is not None:
        _validate_credential(update_kwargs["credential_id"])

    updated = server_repo.update(server_db_id, **update_kwargs)
    logger.info("Updated NiFi server id=%d", server_db_id)
    return _server_to_response(updated)


def delete_server(server_db_id: int) -> None:
    """Delete a NiFi server."""
    if not server_repo.delete(server_db_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi server with id %d not found" % server_db_id,
        )
    logger.info("Deleted NiFi server id=%d", server_db_id)


# ---------------------------------------------------------------------------
# Cluster CRUD
# ---------------------------------------------------------------------------


def _validate_cluster_members(members) -> None:
    if not members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one member instance is required",
        )
    primary_count = sum(1 for m in members if m.is_primary)
    if primary_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exactly one member must be marked as primary (none found)",
        )
    if primary_count > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exactly one member must be marked as primary (%d found)"
            % primary_count,
        )


def list_clusters() -> List[NifiClusterResponse]:
    """Return all NiFi clusters with their members."""
    clusters = cluster_repo.get_all_with_members()
    return [_cluster_to_response(c) for c in clusters]


def create_cluster(data: NifiClusterCreate) -> NifiClusterResponse:
    """Create a new NiFi cluster with members."""
    existing = cluster_repo.get_by_cluster_id(data.cluster_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cluster with cluster_id '%s' already exists" % data.cluster_id,
        )

    _validate_cluster_members(data.members)

    # Validate each instance exists and isn't already in another cluster
    for m in data.members:
        inst = instance_repo.get_by_id(m.instance_id)
        if not inst:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Instance with id %d not found" % m.instance_id,
            )
        existing_membership = cluster_repo.get_cluster_for_instance(m.instance_id)
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Instance id %d is already assigned to another cluster"
                % m.instance_id,
            )

    cluster = cluster_repo.create(
        cluster_id=data.cluster_id,
        hierarchy_attribute=data.hierarchy_attribute,
        hierarchy_value=data.hierarchy_value,
    )

    cluster_repo.set_members(
        cluster.id,
        [
            {"instance_id": m.instance_id, "is_primary": m.is_primary}
            for m in data.members
        ],
    )

    # Re-fetch with members loaded
    refreshed = cluster_repo.get_all_with_members()
    for c in refreshed:
        if c.id == cluster.id:
            logger.info(
                "Created NiFi cluster cluster_id=%s id=%d",
                cluster.cluster_id,
                cluster.id,
            )
            return _cluster_to_response(c)

    raise HTTPException(
        status_code=500, detail="Cluster created but could not be retrieved"
    )


def update_cluster(cluster_db_id: int, data: NifiClusterUpdate) -> NifiClusterResponse:
    """Update an existing NiFi cluster."""
    cluster = cluster_repo.get_by_id(cluster_db_id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi cluster with id %d not found" % cluster_db_id,
        )

    update_kwargs = data.model_dump(exclude_unset=True)
    members_input = update_kwargs.pop("members", None)

    if (
        "cluster_id" in update_kwargs
        and update_kwargs["cluster_id"] != cluster.cluster_id
    ):
        conflict = cluster_repo.get_by_cluster_id(update_kwargs["cluster_id"])
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cluster with cluster_id '%s' already exists"
                % update_kwargs["cluster_id"],
            )

    if update_kwargs:
        cluster_repo.update(cluster_db_id, **update_kwargs)

    if members_input is not None:
        if not members_input:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one member instance is required",
            )
        primary_count = sum(1 for m in members_input if m["is_primary"])
        if primary_count != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exactly one member must be marked as primary",
            )
        # Validate instances exist and don't belong to a DIFFERENT cluster
        for m in members_input:
            inst = instance_repo.get_by_id(m["instance_id"])
            if not inst:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Instance with id %d not found" % m["instance_id"],
                )
            existing_membership = cluster_repo.get_cluster_for_instance(
                m["instance_id"]
            )
            if existing_membership and existing_membership.cluster_id != cluster_db_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Instance id %d is already assigned to another cluster"
                    % m.instance_id,
                )

        cluster_repo.set_members(
            cluster_db_id,
            [
                {"instance_id": m["instance_id"], "is_primary": m["is_primary"]}
                for m in members_input
            ],
        )

    # Re-fetch with members
    refreshed = cluster_repo.get_all_with_members()
    for c in refreshed:
        if c.id == cluster_db_id:
            logger.info("Updated NiFi cluster id=%d", cluster_db_id)
            return _cluster_to_response(c)

    raise HTTPException(
        status_code=500, detail="Cluster updated but could not be retrieved"
    )


def delete_cluster(cluster_db_id: int) -> None:
    """Delete a NiFi cluster (cascade-deletes members, not instances)."""
    if not cluster_repo.delete(cluster_db_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi cluster with id %d not found" % cluster_db_id,
        )
    logger.info("Deleted NiFi cluster id=%d", cluster_db_id)


def get_primary_instance(cluster_db_id: int) -> NifiClusterPrimaryResponse:
    """Return the primary NiFi instance for a cluster.

    hierarchy_attribute and hierarchy_value are taken from the cluster record
    because those fields are nullable on NifiInstance after migration 008.
    """
    cluster = cluster_repo.get_by_id(cluster_db_id)
    if not cluster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NiFi cluster with id %d not found" % cluster_db_id,
        )

    inst = cluster_repo.get_primary_instance(cluster_db_id)
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No primary instance configured for cluster id %d" % cluster_db_id,
        )

    logger.info(
        "Retrieved primary instance id=%d for cluster id=%d", inst.id, cluster_db_id
    )
    return NifiClusterPrimaryResponse(
        instance_id=inst.id,
        name=inst.name,
        hierarchy_attribute=cluster.hierarchy_attribute,
        hierarchy_value=cluster.hierarchy_value,
        nifi_url=inst.nifi_url,
        username=inst.username,
        use_ssl=inst.use_ssl,
        verify_ssl=inst.verify_ssl,
        certificate_name=inst.certificate_name,
        check_hostname=inst.check_hostname,
        oidc_provider_id=inst.oidc_provider_id,
    )
