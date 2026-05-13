"""
SQLAlchemy models — split by domain for maintainability.

All models are re-exported here for backward compatibility.
Existing code can continue using:
    from core.models import User, Role, Permission

New code can import from specific domain modules:
    from core.models.auth import User, Role, Permission
"""

from core.database import Base

# Agent
from .agent import DatenschleuderAgentCommand

# Audit
from .audit import AuditLog

# Auth
from .auth import (
    Permission,
    Role,
    RolePermission,
    User,
    UserPermission,
    UserProfile,
    UserRole,
)

# Credentials
from .credentials import Credential, LoginCredential

# Git
from .git import GitRepository

# Jobs
from .jobs import Job, JobRun, JobSchedule, JobTemplate

# NiFi
from .nifi import (
    FlowView,
    HierarchyValue,
    NifiCluster,
    NifiClusterInstance,
    NifiClusterServer,
    NifiInstance,
    NifiServer,
    RegistryFlow,
    RegistryFlowMetadata,
)

# PKI
from .pki import PKIAuthority, PKICertificate

# Settings
from .settings import (
    CacheSetting,
    CelerySetting,
    GitSetting,
    RedisServer,
    Setting,
    SettingsMetadata,
)

# Templates
from .templates import Template, TemplateVersion

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
