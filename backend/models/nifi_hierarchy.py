"""Pydantic schemas for NiFi hierarchy configuration."""

from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import List, Optional


class HierarchyValueCreate(BaseModel):
    """Schema for creating a hierarchy value."""

    attribute_name: str
    value: str


class HierarchyValueResponse(BaseModel):
    """Schema for hierarchy value response."""

    id: int
    attribute_name: str
    value: str
    created_at: datetime

    class Config:
        from_attributes = True


class HierarchyValuesRequest(BaseModel):
    """Schema for batch creating/updating values for an attribute."""

    attribute_name: str
    values: List[str]


class HierarchyAttribute(BaseModel):
    """Single attribute in the hierarchy."""

    name: str
    label: str
    order: int


class HierarchyConfig(BaseModel):
    """Hierarchical data format configuration."""

    hierarchy: List[HierarchyAttribute]

    @field_validator("hierarchy")
    @classmethod
    def validate_unique_names(cls, v):
        names = [attr.name for attr in v]
        if len(names) != len(set(names)):
            raise ValueError("Attribute names must be unique")
        return v
