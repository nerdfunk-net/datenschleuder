"""Pydantic schemas for NiFi instance management."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NifiInstanceCreate(BaseModel):
    """Schema for creating a NiFi instance."""

    name: Optional[str] = None
    hierarchy_attribute: Optional[str] = None
    hierarchy_value: Optional[str] = None
    server_id: Optional[int] = None
    nifi_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    use_ssl: bool = True
    verify_ssl: bool = True
    certificate_name: Optional[str] = None
    check_hostname: bool = True
    oidc_provider_id: Optional[str] = None
    git_config_repo_id: Optional[int] = None


class NifiInstanceUpdate(BaseModel):
    """Schema for updating a NiFi instance."""

    name: Optional[str] = None
    server_id: Optional[int] = None
    nifi_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    use_ssl: Optional[bool] = None
    verify_ssl: Optional[bool] = None
    certificate_name: Optional[str] = None
    check_hostname: Optional[bool] = None
    oidc_provider_id: Optional[str] = None
    git_config_repo_id: Optional[int] = None


class NifiInstanceResponse(BaseModel):
    """Schema for NiFi instance response."""

    id: int
    name: Optional[str] = None
    hierarchy_attribute: Optional[str] = None
    hierarchy_value: Optional[str] = None
    server_id: Optional[int] = None
    nifi_url: str
    username: Optional[str] = None
    use_ssl: bool
    verify_ssl: bool
    certificate_name: Optional[str] = None
    check_hostname: bool
    oidc_provider_id: Optional[str] = None
    git_config_repo_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NifiInstanceTestConnection(BaseModel):
    """Schema for testing NiFi connection without saving."""

    nifi_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    use_ssl: bool = True
    verify_ssl: bool = True
    certificate_name: Optional[str] = None
    check_hostname: bool = True
    oidc_provider_id: Optional[str] = None
