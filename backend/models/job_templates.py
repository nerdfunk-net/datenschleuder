"""
Pydantic models for job templates management
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime


# Valid job template types
JobTemplateType = Literal[
    "check_queues",
    "check_progress_group",
]


class JobTemplateBase(BaseModel):
    """Base model for job templates"""

    name: str = Field(
        ..., min_length=1, max_length=255, description="Name of the job template"
    )
    job_type: JobTemplateType = Field(
        ..., description="Type of job this template represents"
    )
    description: Optional[str] = Field(
        None, max_length=1000, description="Description of what this template does"
    )
    nifi_cluster_ids: Optional[List[int]] = Field(
        None,
        description="List of NiFi cluster IDs to run the job against; None means all clusters (only applies to check_queues type)",
    )
    check_queues_mode: Optional[str] = Field(
        "count",
        description="Metric to evaluate: 'count' (flow-file count), 'bytes' (queue size in MB), or 'both' (only applies to check_queues type)",
    )
    check_queues_count_yellow: Optional[int] = Field(
        1000,
        ge=0,
        description="Flow-file count at which the queue status turns yellow (only applies to check_queues type)",
    )
    check_queues_count_red: Optional[int] = Field(
        10000,
        ge=0,
        description="Flow-file count at which the queue status turns red (only applies to check_queues type)",
    )
    check_queues_bytes_yellow: Optional[int] = Field(
        10,
        ge=0,
        description="Queue size in MB at which the status turns yellow (only applies to check_queues type)",
    )
    check_queues_bytes_red: Optional[int] = Field(
        100,
        ge=0,
        description="Queue size in MB at which the status turns red (only applies to check_queues type)",
    )
    check_progress_group_nifi_cluster_id: Optional[int] = Field(
        None,
        description="ID of the NiFi cluster to target (only applies to check_progress_group type)",
    )
    check_progress_group_process_group_id: Optional[str] = Field(
        None,
        max_length=255,
        description="UUID of the process group to check (only applies to check_progress_group type)",
    )
    check_progress_group_process_group_path: Optional[str] = Field(
        None,
        max_length=1000,
        description="Human-readable formatted path of the process group (only applies to check_progress_group type)",
    )
    check_progress_group_check_children: Optional[bool] = Field(
        True,
        description="When True, also check all child process groups (only applies to check_progress_group type)",
    )
    check_progress_group_expected_status: Optional[str] = Field(
        "Running",
        description="Expected operational status: 'Running', 'Stopped', 'Enabled', or 'Disabled' (only applies to check_progress_group type)",
    )
    is_global: bool = Field(
        False,
        description="Whether this template is global (available to all users) or private",
    )


class JobTemplateCreate(JobTemplateBase):
    """Model for creating a new job template"""

    pass


class JobTemplateUpdate(BaseModel):
    """Model for updating a job template"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    nifi_cluster_ids: Optional[List[int]] = None
    check_queues_mode: Optional[str] = None
    check_queues_count_yellow: Optional[int] = Field(None, ge=0)
    check_queues_count_red: Optional[int] = Field(None, ge=0)
    check_queues_bytes_yellow: Optional[int] = Field(None, ge=0)
    check_queues_bytes_red: Optional[int] = Field(None, ge=0)
    check_progress_group_nifi_cluster_id: Optional[int] = None
    check_progress_group_process_group_id: Optional[str] = Field(None, max_length=255)
    check_progress_group_process_group_path: Optional[str] = Field(
        None, max_length=1000
    )
    check_progress_group_check_children: Optional[bool] = None
    check_progress_group_expected_status: Optional[str] = None
    is_global: Optional[bool] = None


class JobTemplateResponse(JobTemplateBase):
    """Model for job template response"""

    id: int
    user_id: Optional[int] = None
    created_by: Optional[str] = Field(None, description="Username of the creator")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JobTemplateListResponse(BaseModel):
    """Response model for listing job templates"""

    templates: list[JobTemplateResponse]
    total: int
