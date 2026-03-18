"""Pydantic schemas for NiFi server management."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NifiServerCreate(BaseModel):
    """Schema for creating a NiFi server."""

    server_id: str
    hostname: str
    credential_id: Optional[int] = None
    installation_type: str = "bare"


class NifiServerUpdate(BaseModel):
    """Schema for updating a NiFi server."""

    server_id: Optional[str] = None
    hostname: Optional[str] = None
    credential_id: Optional[int] = None
    installation_type: Optional[str] = None


class NifiServerResponse(BaseModel):
    """Schema for NiFi server response."""

    id: int
    server_id: str
    hostname: str
    credential_id: Optional[int] = None
    credential_name: Optional[str] = None
    installation_type: str = "bare"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
