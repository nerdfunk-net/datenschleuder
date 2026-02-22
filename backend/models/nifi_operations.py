"""Pydantic schemas for NiFi flow operations."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# ============================================================================
# NiFi Flow Schemas
# ============================================================================


class NifiFlowCreate(BaseModel):
    """Schema for creating a NiFi flow."""

    hierarchy_values: dict
    name: Optional[str] = None
    contact: Optional[str] = None
    src_connection_param: str
    dest_connection_param: str
    src_template_id: Optional[int] = None
    dest_template_id: Optional[int] = None
    active: bool = True
    description: Optional[str] = None
    creator_name: Optional[str] = None


class NifiFlowUpdate(BaseModel):
    """Schema for updating a NiFi flow."""

    hierarchy_values: Optional[dict] = None
    name: Optional[str] = None
    contact: Optional[str] = None
    src_connection_param: Optional[str] = None
    dest_connection_param: Optional[str] = None
    src_template_id: Optional[int] = None
    dest_template_id: Optional[int] = None
    active: Optional[bool] = None
    description: Optional[str] = None


class NifiFlowResponse(BaseModel):
    """Schema for NiFi flow response."""

    id: int
    hierarchy_values: dict
    name: Optional[str] = None
    contact: Optional[str] = None
    src_connection_param: str
    dest_connection_param: str
    src_template_id: Optional[int] = None
    dest_template_id: Optional[int] = None
    active: bool
    description: Optional[str] = None
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Registry Flow Schemas
# ============================================================================


class RegistryFlowCreate(BaseModel):
    """Schema for creating a registry flow."""

    nifi_instance_id: int
    nifi_instance_name: str
    nifi_instance_url: str
    registry_id: str
    registry_name: str
    bucket_id: str
    bucket_name: str
    flow_id: str
    flow_name: str
    flow_description: Optional[str] = None


class RegistryFlowResponse(BaseModel):
    """Schema for registry flow response."""

    id: int
    nifi_instance_id: int
    nifi_instance_name: str
    nifi_instance_url: str
    registry_id: str
    registry_name: str
    bucket_id: str
    bucket_name: str
    flow_id: str
    flow_name: str
    flow_description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Flow View Schemas
# ============================================================================


class FlowViewCreate(BaseModel):
    """Schema for creating a flow view."""

    name: str
    description: Optional[str] = None
    visible_columns: List[str]
    column_widths: Optional[dict] = None
    is_default: bool = False


class FlowViewUpdate(BaseModel):
    """Schema for updating a flow view."""

    name: Optional[str] = None
    description: Optional[str] = None
    visible_columns: Optional[List[str]] = None
    column_widths: Optional[dict] = None
    is_default: Optional[bool] = None


class FlowViewResponse(BaseModel):
    """Schema for flow view response."""

    id: int
    name: str
    description: Optional[str] = None
    visible_columns: List[str]
    column_widths: Optional[dict] = None
    is_default: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
