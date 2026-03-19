"""
Pydantic models for job management

All request/response schemas for job operations.
Organized by domain:
  - Job Template Models
  - Job Schedule Models
  - Job Run Models
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime


# ============================================================================
# Job Template Models (from job_templates.py)
# ============================================================================

# Valid job template types
JobTemplateType = Literal[
    "check_queues",
    "check_progress_group",
    "export_flows",
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
    export_flows_nifi_cluster_ids: Optional[List[int]] = Field(
        None,
        description="List of NiFi cluster IDs (informational label only; flows come from local DB) (only applies to export_flows type)",
    )
    export_flows_all_flows: Optional[bool] = Field(
        True,
        description="When True, export all flows; when False use export_flows_filters (only applies to export_flows type)",
    )
    export_flows_filters: Optional[dict] = Field(
        None,
        description="Hierarchy filter conditions keyed by attribute name (only applies to export_flows type)",
    )
    export_flows_git_repo_id: Optional[int] = Field(
        None,
        description="ID of the git repository to write the exported file into (only applies to export_flows type)",
    )
    export_flows_filename: Optional[str] = Field(
        None,
        max_length=255,
        description="Output filename (extension added automatically if omitted) (only applies to export_flows type)",
    )
    export_flows_export_type: Optional[str] = Field(
        "json",
        description="Export format: 'json' or 'csv' (only applies to export_flows type)",
    )
    export_flows_push_to_git: Optional[bool] = Field(
        True,
        description="When True, commit and push the exported file to the git repository (only applies to export_flows type)",
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
    export_flows_nifi_cluster_ids: Optional[List[int]] = None
    export_flows_all_flows: Optional[bool] = None
    export_flows_filters: Optional[dict] = None
    export_flows_git_repo_id: Optional[int] = None
    export_flows_filename: Optional[str] = Field(None, max_length=255)
    export_flows_export_type: Optional[str] = None
    export_flows_push_to_git: Optional[bool] = None
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


# ============================================================================
# Job Schedule Models
# ============================================================================


class JobScheduleBase(BaseModel):
    """Base model for job scheduling"""

    job_identifier: str = Field(
        ..., description="Unique identifier for this schedule (user-defined)"
    )
    job_template_id: int = Field(..., description="ID of the job template to use")
    schedule_type: Literal[
        "now", "interval", "hourly", "daily", "weekly", "monthly", "custom"
    ] = Field(..., description="Schedule frequency")
    cron_expression: Optional[str] = Field(
        None, description="Cron expression for custom schedules"
    )
    interval_minutes: Optional[int] = Field(
        None, description="Interval in minutes for interval-based schedules"
    )
    start_time: Optional[str] = Field(
        None,
        description="Start time in HH:MM format (24-hour) for time-based schedules",
    )
    start_date: Optional[str] = Field(
        None,
        description="Start date in YYYY-MM-DD format for one-time or initial scheduled runs",
    )
    is_active: bool = Field(True, description="Whether the job is active")
    is_global: bool = Field(
        True,
        description="Whether the job is global (all users) or private (user-specific)",
    )
    credential_id: Optional[int] = Field(
        None, description="ID of credential to use (if any)"
    )
    job_parameters: Optional[dict] = Field(
        None, description="Additional parameters for the job"
    )


class JobScheduleCreate(JobScheduleBase):
    """Model for creating a new scheduled job"""

    user_id: Optional[int] = Field(None, description="User ID for private jobs")


class JobScheduleUpdate(BaseModel):
    """Model for updating a scheduled job"""

    job_identifier: Optional[str] = None
    schedule_type: Optional[
        Literal["now", "interval", "hourly", "daily", "weekly", "monthly", "custom"]
    ] = None
    cron_expression: Optional[str] = None
    interval_minutes: Optional[int] = None
    start_time: Optional[str] = None
    start_date: Optional[str] = None
    is_active: Optional[bool] = None
    credential_id: Optional[int] = None
    job_parameters: Optional[dict] = None


class JobScheduleResponse(JobScheduleBase):
    """Model for job schedule response"""

    id: int
    job_template_id: Optional[int] = Field(
        None, description="ID of the job template to use"
    )
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    # Additional fields for display (populated from template)
    template_name: Optional[str] = Field(
        None, description="Name of the associated job template"
    )
    template_job_type: Optional[str] = Field(
        None, description="Job type from the template"
    )

    class Config:
        from_attributes = True


class JobExecutionRequest(BaseModel):
    """Model for executing a job immediately"""

    job_schedule_id: int
    override_parameters: Optional[dict] = None


# ============================================================================
# Job Run Models
# ============================================================================


class JobRunBase(BaseModel):
    """Base model for job runs"""

    job_schedule_id: Optional[int] = Field(
        None, description="ID of the schedule that triggered this run"
    )
    job_template_id: Optional[int] = Field(None, description="ID of the job template")
    job_name: str = Field(..., description="Name of the job (snapshot)")
    job_type: str = Field(..., description="Type of job (snapshot)")
    triggered_by: Literal["schedule", "manual"] = Field(
        "schedule", description="How the job was triggered"
    )
    target_devices: Optional[list[str]] = Field(
        None, description="List of target device names"
    )
    executed_by: Optional[str] = Field(
        None, description="Username who triggered manual run"
    )


class JobRunCreate(JobRunBase):
    """Model for creating a new job run"""

    celery_task_id: Optional[str] = Field(None, description="Celery task UUID")


class JobRunUpdate(BaseModel):
    """Model for updating a job run"""

    status: Optional[
        Literal["pending", "running", "completed", "failed", "cancelled"]
    ] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[dict] = None
    celery_task_id: Optional[str] = None


class JobRunResponse(BaseModel):
    """Model for job run response"""

    id: int
    job_schedule_id: Optional[int] = None
    job_template_id: Optional[int] = None
    celery_task_id: Optional[str] = None
    job_name: str
    job_type: str
    status: str
    triggered_by: str
    queued_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = Field(
        None, description="Duration in seconds (computed)"
    )
    error_message: Optional[str] = None
    result: Optional[dict] = None
    target_devices: Optional[list[str]] = None
    executed_by: Optional[str] = None
    # Additional fields from relationships
    schedule_name: Optional[str] = Field(
        None, description="Name of the schedule (if still exists)"
    )
    template_name: Optional[str] = Field(
        None, description="Name of the template (if still exists)"
    )

    class Config:
        from_attributes = True


class JobRunListResponse(BaseModel):
    """Paginated list of job runs"""

    items: list[JobRunResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
