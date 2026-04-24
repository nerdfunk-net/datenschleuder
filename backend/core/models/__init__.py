"""
SQLAlchemy models — split by domain for maintainability.

All models are re-exported here for backward compatibility.
Existing code can continue using:
    from core.models import User, Role, Permission

New code can import from specific domain modules:
    from core.models.auth import User, Role, Permission
"""

from core.database import Base

# Auth
from .auth import (
    User,
    UserProfile,
    Role,
    Permission,
    RolePermission,
    UserRole,
    UserPermission,
)

# Credentials
from .credentials import Credential, LoginCredential

# Git
from .git import GitRepository

# Jobs
from .jobs import Job, JobTemplate, JobSchedule, JobRun

# Templates
from .templates import Template, TemplateVersion

# Settings
from .settings import (
    Setting,
    GitSetting,
    CacheSetting,
    CelerySetting,
    SettingsMetadata,
    RedisServer,
)

# Audit
from .audit import AuditLog

# NiFi
from .nifi import (
    NifiServer,
    NifiCluster,
    NifiClusterServer,
    NifiClusterInstance,
    NifiInstance,
    RegistryFlow,
    RegistryFlowMetadata,
    FlowView,
    HierarchyValue,
)

# PKI
from .pki import PKIAuthority, PKICertificate

# Agent
from .agent import DatenschleuderAgentCommand

__all__ = [
    "Base",
    # Auth
    "User",
    "UserProfile",
    "Role",
    "Permission",
    "RolePermission",
    "UserRole",
    "UserPermission",
    # Credentials
    "Credential",
    "LoginCredential",
    # Git
    "GitRepository",
    # Jobs
    "Job",
    "JobTemplate",
    "JobSchedule",
    "JobRun",
    # Templates
    "Template",
    "TemplateVersion",
    # Settings
    "Setting",
    "GitSetting",
    "CacheSetting",
    "CelerySetting",
    "SettingsMetadata",
    "RedisServer",
    # Audit
    "AuditLog",
    # NiFi
    "NifiServer",
    "NifiCluster",
    "NifiClusterServer",
    "NifiClusterInstance",
    "NifiInstance",
    "RegistryFlow",
    "RegistryFlowMetadata",
    "FlowView",
    "HierarchyValue",
    # PKI
    "PKIAuthority",
    "PKICertificate",
    # Agent
    "DatenschleuderAgentCommand",
]
