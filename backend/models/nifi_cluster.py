"""Pydantic schemas for NiFi cluster management."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class NifiClusterMemberInput(BaseModel):
    """Input schema for a cluster member."""

    instance_id: int
    is_primary: bool = False


class NifiClusterCreate(BaseModel):
    """Schema for creating a NiFi cluster."""

    cluster_id: str
    hierarchy_attribute: str
    hierarchy_value: str
    members: List[NifiClusterMemberInput]


class NifiClusterUpdate(BaseModel):
    """Schema for updating a NiFi cluster."""

    cluster_id: Optional[str] = None
    hierarchy_attribute: Optional[str] = None
    hierarchy_value: Optional[str] = None
    members: Optional[List[NifiClusterMemberInput]] = None


class NifiClusterMemberResponse(BaseModel):
    """Response schema for a cluster member (NiFi instance)."""

    instance_id: int
    name: Optional[str]
    nifi_url: str
    is_primary: bool


class NifiClusterResponse(BaseModel):
    """Schema for NiFi cluster response."""

    id: int
    cluster_id: str
    hierarchy_attribute: str
    hierarchy_value: str
    members: List[NifiClusterMemberResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NifiClusterPrimaryResponse(BaseModel):
    """Response for the get-primary endpoint.

    Returns the primary NiFi instance of a cluster, with hierarchy metadata
    taken from the cluster (not the instance, where those fields are nullable).
    """

    instance_id: int
    name: Optional[str]
    hierarchy_attribute: str
    hierarchy_value: str
    nifi_url: str
    username: Optional[str]
    use_ssl: bool
    verify_ssl: bool
    certificate_name: Optional[str]
    check_hostname: bool
    oidc_provider_id: Optional[str]
