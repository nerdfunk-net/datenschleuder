"""Job models: Job, JobSchedule, JobTemplate, JobRun."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from core.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    job_type = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    progress = Column(Integer, nullable=False, default=0)
    message = Column(Text)
    result = Column(Text)  # JSON string
    created_by = Column(String(255))
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_jobs_status", "status"),
        Index("idx_jobs_type", "job_type"),
        Index("idx_jobs_created_at", "created_at"),
    )


class JobSchedule(Base):
    __tablename__ = "job_schedules"

    id = Column(Integer, primary_key=True, index=True)
    job_identifier = Column(String(255), nullable=False, index=True)
    job_template_id = Column(Integer, ForeignKey("job_templates.id"), nullable=False)
    schedule_type = Column(String(50), nullable=False)
    cron_expression = Column(String(255))
    interval_minutes = Column(Integer)
    start_time = Column(String(50))
    start_date = Column(String(50))
    is_active = Column(Boolean, nullable=False, default=True)
    is_global = Column(Boolean, nullable=False, default=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    credential_id = Column(Integer)
    job_parameters = Column(Text)  # JSON string
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    last_run = Column(DateTime(timezone=True))
    next_run = Column(DateTime(timezone=True))

    # Relationship to JobTemplate
    template = relationship(
        "JobTemplate", backref=backref("schedules", cascade="all, delete-orphan")
    )


class JobTemplate(Base):
    """Job templates define reusable job configurations"""

    __tablename__ = "job_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    job_type = Column(String(50), nullable=False)  # check_queues, check_progress_group
    description = Column(Text)
    check_queues_mode = Column(
        String(10), nullable=True, default="count"
    )  # Metric to evaluate: 'count', 'bytes', or 'both' (check_queues type)
    check_queues_count_yellow = Column(
        Integer, nullable=True, default=1000
    )  # Flow-file count threshold for yellow status (check_queues type)
    check_queues_count_red = Column(
        Integer, nullable=True, default=10000
    )  # Flow-file count threshold for red status (check_queues type)
    check_queues_bytes_yellow = Column(
        Integer, nullable=True, default=10
    )  # Queue size threshold for yellow status in MB (check_queues type)
    check_queues_bytes_red = Column(
        Integer, nullable=True, default=100
    )  # Queue size threshold for red status in MB (check_queues type)
    nifi_cluster_ids = Column(
        Text, nullable=True
    )  # JSON array of NiFi cluster IDs to run against (check_queues type)
    check_progress_group_nifi_cluster_id = Column(
        Integer, ForeignKey("nifi_clusters.id", ondelete="SET NULL"), nullable=True
    )  # Single NiFi cluster ID to target (check_progress_group type)
    check_progress_group_process_group_id = Column(
        String(255), nullable=True
    )  # UUID of the process group (check_progress_group type)
    check_progress_group_process_group_path = Column(
        String(1000), nullable=True
    )  # Formatted path of the process group for display (check_progress_group type)
    check_progress_group_check_children = Column(
        Boolean, nullable=True, default=True
    )  # Whether to check child process groups (check_progress_group type)
    check_progress_group_expected_status = Column(
        String(20), nullable=True, default="Running"
    )  # Expected status: Running|Stopped|Enabled|Disabled (check_progress_group type)
    export_flows_nifi_cluster_ids = Column(
        Text, nullable=True
    )  # JSON array of NiFi cluster IDs (informational, export_flows type)
    export_flows_all_flows = Column(
        Boolean, nullable=True, default=True
    )  # When True, export all flows; False = use filters (export_flows type)
    export_flows_filters = Column(
        Text, nullable=True
    )  # JSON object with hierarchy filters (export_flows type)
    export_flows_git_repo_id = Column(
        Integer, ForeignKey("git_repositories.id", ondelete="SET NULL"), nullable=True
    )  # Target git repository for the export (export_flows type)
    export_flows_filename = Column(
        String(255), nullable=True
    )  # Output filename (export_flows type)
    export_flows_export_type = Column(
        String(10), nullable=True, default="json"
    )  # Export format: 'json' or 'csv' (export_flows type)
    export_flows_push_to_git = Column(
        Boolean, nullable=True, default=True
    )  # When True, commit and push to git after export (export_flows type)
    is_global = Column(Boolean, nullable=False, default=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_by = Column(String(255))  # Username of creator
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_job_templates_type", "job_type"),
        Index("idx_job_templates_user", "user_id"),
        Index("idx_job_templates_user_type", "user_id", "job_type"),
        CheckConstraint(
            "job_type IN ('check_queues', 'check_progress_group', 'export_flows')",
            name="ck_job_templates_job_type",
        ),
    )


class JobRun(Base):
    """Tracks individual job executions"""

    __tablename__ = "job_runs"

    id = Column(Integer, primary_key=True, index=True)
    job_schedule_id = Column(
        Integer,
        ForeignKey("job_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    job_template_id = Column(
        Integer,
        ForeignKey("job_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    celery_task_id = Column(String(255), unique=True, index=True)  # Celery task UUID

    # Job info snapshot (in case template/schedule is deleted)
    job_name = Column(
        String(255), nullable=False
    )  # Snapshot of schedule's job_identifier
    job_type = Column(String(50), nullable=False)  # Snapshot of template's job_type

    # Execution status
    status = Column(
        String(50), nullable=False, default="pending", index=True
    )  # pending, running, completed, failed, cancelled
    triggered_by = Column(
        String(50), nullable=False, default="schedule"
    )  # schedule, manual

    # Timing
    queued_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Results
    error_message = Column(Text)
    result = Column(Text)  # JSON string for structured results

    # Execution context snapshot
    target_devices = Column(Text)  # JSON array of device names targeted
    executed_by = Column(String(255))  # Username who triggered (for manual runs)

    # Relationships
    schedule = relationship("JobSchedule", backref="runs")
    template = relationship("JobTemplate", backref="runs")

    __table_args__ = (
        Index("idx_job_runs_status", "status"),
        Index("idx_job_runs_queued_at", "queued_at"),
        Index("idx_job_runs_triggered_by", "triggered_by"),
    )
