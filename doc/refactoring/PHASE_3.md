# Phase 3: Split Large Files

## Goal

Split monolithic files into domain-organized modules while maintaining full backward compatibility. This phase targets files that are too large to navigate effectively and mix unrelated concerns.

## Prerequisite

Phase 1 and Phase 2 should be completed first. Phase 1 eliminates root-level managers (which are heavy importers of `core/models.py`), and Phase 2 simplifies routers. Both reduce the number of import sites that need to be verified.

## Current State

3 files targeted for splitting:

| File | Lines | Classes/Methods | Issue |
|---|---|---|---|
| `core/models.py` | 1,177 | 34 SQLAlchemy models | Monolithic — all DB models in one file |
| `services/agent_service.py` | 473 | 1 class + 5 functions | Mixed concerns — Redis, Pub/Sub, parsing, DB |
| `repositories/auth/rbac_repository.py` | 425 | 1 class, 22 methods | Large but acceptable — optional improvement |

---

## Step 1: Split `core/models.py` into Domain Modules

### Current Organization

34 SQLAlchemy models in a single 1,177-line file, grouped (informally) by domain:

| Domain | Models | Line Range | Count |
|---|---|---|---|
| **Auth** | `User`, `UserProfile`, `Role`, `Permission`, `RolePermission`, `UserRole`, `UserPermission` | 30-195 | 7 |
| **Settings** | `Setting` | 203-222 | 1 |
| **Credentials** | `Credential`, `LoginCredential` | 230-295 | 2 |
| **Git** | `GitRepository` | 302-338 | 1 |
| **Jobs** | `Job`, `JobSchedule`, `JobTemplate`, `JobRun` | 345-526 | 4 |
| **Templates** | `Template`, `TemplateVersion` | 539-640 | 2 |
| **Settings (continued)** | `GitSetting`, `CacheSetting`, `CelerySetting`, `SettingsMetadata` | 648-743 | 4 |
| **Audit** | `AuditLog` | 751-782 | 1 |
| **NiFi** | `NifiServer`, `NifiCluster`, `NifiClusterServer`, `NifiClusterInstance`, `NifiInstance`, `RegistryFlow`, `RegistryFlowMetadata`, `FlowView`, `HierarchyValue` | 790-1053 | 9 |
| **PKI** | `PKIAuthority`, `PKICertificate` | 1066-1151 | 2 |
| **Agent** | `DatenschleuderAgentCommand` | 1154-1176 | 1 |

### Cross-Domain Foreign Key Map

Understanding cross-domain relationships is critical for determining safe split boundaries:

```
AUTH (internal):
├── User (1) ←→ (M) UserRole
├── User (1) ←→ (M) UserPermission
├── Role (1) ←→ (M) RolePermission
├── Permission (1) ←→ (M) RolePermission
└── Permission (1) ←→ (M) UserPermission

Cross-domain FKs:
├── JOBS → AUTH:    JobSchedule.user_id → User.id
├── JOBS → AUTH:    JobTemplate.user_id → User.id
├── JOBS → NIFI:    JobTemplate.check_progress_group_nifi_cluster_id → NifiCluster.id
├── JOBS → JOBS:    JobSchedule (1) ←── (M) JobRun
├── JOBS → JOBS:    JobTemplate (1) ←── (M) JobRun
├── TEMPLATES:      Template (1) ←── (M) TemplateVersion
├── SETTINGS → AUTH: SettingsMetadata.changed_by → User.id
├── AUDIT → AUTH:   AuditLog.user_id → User.id (SET NULL)
├── CREDENTIALS → NIFI: NifiServer.credential_id → Credential.id
├── GIT → NIFI:     NifiInstance.git_config_repo_id → GitRepository.id
├── NIFI (internal): Complex cluster/instance/flow hierarchy (9 FKs)
└── PKI (internal):  PKIAuthority (1) ←── (M) PKICertificate
```

**Key insight:** Most cross-domain references use string-based foreign keys (`ForeignKey("users.id")`), not Python object references, so splitting into separate files does not create circular import issues at the SQLAlchemy level.

### Target Structure

```
backend/core/
├── models/
│   ├── __init__.py         # Re-exports ALL models for backward compat
│   ├── base.py             # Shared Base declarative_base
│   ├── auth.py             # User, UserProfile, Role, Permission, RolePermission, UserRole, UserPermission
│   ├── credentials.py      # Credential, LoginCredential
│   ├── git.py              # GitRepository
│   ├── jobs.py             # Job, JobTemplate, JobSchedule, JobRun
│   ├── templates.py        # Template, TemplateVersion
│   ├── settings.py         # Setting, GitSetting, CacheSetting, CelerySetting, SettingsMetadata
│   ├── audit.py            # AuditLog
│   ├── nifi.py             # NifiServer, NifiCluster, NifiClusterServer, NifiClusterInstance,
│   │                       #   NifiInstance, RegistryFlow, RegistryFlowMetadata, FlowView, HierarchyValue
│   ├── pki.py              # PKIAuthority, PKICertificate
│   └── agent.py            # DatenschleuderAgentCommand
```

### Critical: Backward Compatibility via Re-export

**33 files** import from `core.models`. All must continue working without modification.

#### `/backend/core/models/__init__.py`

```python
"""
SQLAlchemy models - split by domain.

All models are re-exported here for backward compatibility.
Existing code can continue using:
    from core.models import User, Role, Permission

New code can import from specific domain modules:
    from core.models.auth import User, Role, Permission
"""

from .base import Base

# Auth
from .auth import User, UserProfile, Role, Permission, RolePermission, UserRole, UserPermission

# Credentials
from .credentials import Credential, LoginCredential

# Git
from .git import GitRepository

# Jobs
from .jobs import Job, JobTemplate, JobSchedule, JobRun

# Templates
from .templates import Template, TemplateVersion

# Settings
from .settings import Setting, GitSetting, CacheSetting, CelerySetting, SettingsMetadata

# Audit
from .audit import AuditLog

# NiFi
from .nifi import (
    NifiServer, NifiCluster, NifiClusterServer, NifiClusterInstance,
    NifiInstance, RegistryFlow, RegistryFlowMetadata, FlowView, HierarchyValue,
)

# PKI
from .pki import PKIAuthority, PKICertificate

# Agent
from .agent import DatenschleuderAgentCommand

__all__ = [
    "Base",
    # Auth
    "User", "UserProfile", "Role", "Permission", "RolePermission", "UserRole", "UserPermission",
    # Credentials
    "Credential", "LoginCredential",
    # Git
    "GitRepository",
    # Jobs
    "Job", "JobTemplate", "JobSchedule", "JobRun",
    # Templates
    "Template", "TemplateVersion",
    # Settings
    "Setting", "GitSetting", "CacheSetting", "CelerySetting", "SettingsMetadata",
    # Audit
    "AuditLog",
    # NiFi
    "NifiServer", "NifiCluster", "NifiClusterServer", "NifiClusterInstance",
    "NifiInstance", "RegistryFlow", "RegistryFlowMetadata", "FlowView", "HierarchyValue",
    # PKI
    "PKIAuthority", "PKICertificate",
    # Agent
    "DatenschleuderAgentCommand",
]
```

### Critical: Shared `Base` Object

All models inherit from the same `Base = declarative_base()`. This must be defined in a single shared location:

#### `/backend/core/models/base.py`

```python
from sqlalchemy.orm import declarative_base

Base = declarative_base()
```

Each domain module imports from `base.py`:

```python
# core/models/auth.py
from .base import Base
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"
    # ...
```

### Critical: `core/database.py` Reflection

**File:** `/backend/core/database.py` (line 88)

```python
# Inside init_db() function — used for SQLAlchemy model discovery / Alembic
from core import models  # noqa: F401
```

This import triggers Python to load the `core.models` package, which in turn loads all domain modules via `__init__.py` re-exports. **This continues to work with the new structure** because the `__init__.py` imports all models.

**Verify:** After splitting, run `python -c "from core import models; print(dir(models))"` to confirm all models are discoverable.

### Critical: Alembic Migrations

Check the Alembic `env.py` configuration:

```python
# Likely in alembic/env.py or migrations/env.py
from core.models import Base
target_metadata = Base.metadata
```

This continues to work because `Base` is re-exported from `__init__.py`.

**IMPORTANT:** Run `alembic check` (or equivalent) after splitting to verify Alembic can still detect all models.

### Dynamic/Lazy Import Sites (Must Verify)

Two files use function-level imports that need verification:

1. **`/backend/settings_manager.py` line 469** (or its Phase 1 replacement):
   ```python
   from core.models import GitSetting, CacheSetting, CelerySetting
   ```
   Works with re-export. No change needed.

2. **`/backend/repositories/nifi/nifi_cluster_repository.py` line 69**:
   ```python
   from core.models import NifiClusterInstance, NifiInstance
   ```
   Works with re-export. No change needed.

### Import Consumers (33 files)

All use `from core.models import ModelName` pattern. With re-export `__init__.py`, **zero changes needed** in consuming files.

| Layer | File Count | Example |
|---|---|---|
| Repositories | 22 | `from core.models import User` |
| Services | 4 | `from core.models import RegistryFlow` |
| Managers (→ services after Phase 1) | 6 | `from core.models import Role, Permission` |
| Core | 1 | `from core import models` (database.py) |
| Scripts | 1 | `from core.models import Credential` |

### Implementation Steps

1. Create `/backend/core/models/` directory
2. Create `base.py` with shared `Base`
3. Move models to domain files (auth.py, jobs.py, nifi.py, etc.)
4. Each file imports `Base` from `.base`
5. Create `__init__.py` with all re-exports and `__all__`
6. Delete old `/backend/core/models.py` file
7. Verify: `python -c "from core.models import User, NifiServer, JobRun"` succeeds
8. Verify: Alembic can detect all tables
9. Verify: Application starts successfully
10. Run full test suite

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Alembic can't find models | HIGH | CRITICAL | Test `alembic check` immediately after split |
| Import cycle between domain modules | LOW | HIGH | Use string-based ForeignKey refs (already in place) |
| `database.py` reflection breaks | MEDIUM | CRITICAL | Test `init_db()` function specifically |
| Missing model in `__init__.py` | MEDIUM | HIGH | Cross-check count: 34 models, verify all present |
| `Base` not shared correctly | LOW | CRITICAL | Single `base.py` import in all domain files |

---

## Step 2: Split `services/agent_service.py` into Module

### Current Organization

473 lines with 4 distinct concerns:

| Concern | Location | Lines | Dependencies |
|---|---|---|---|
| **Output Parsing** | Top-level functions (lines 31-147) | ~120 | None (pure functions) |
| **Registry (heartbeat)** | `AgentService` methods (lines 171-248) | ~80 | Redis client |
| **Command Execution** | `AgentService` methods (lines 252-465) | ~220 | Redis client, AgentRepository |
| **History** | `AgentService` methods (lines 469-473) | ~5 | AgentRepository |

### Target Structure

```
backend/services/agent/
├── __init__.py         # AgentService facade (backward compat)
├── registry.py         # AgentRegistry — heartbeat status
├── commands.py         # AgentCommands — Pub/Sub command execution
├── history.py          # AgentHistory — DB command history
└── parsers.py          # Pure parsing functions + AgentCommandParser
```

### Module Details

#### `/backend/services/agent/parsers.py` (~120 lines)

Pure functions — no dependencies, no state, fully unit-testable:

```python
def parse_git_status(raw: str) -> list[dict]
    """Parse multi-repo `git status --short --branch` output."""

def parse_list_repositories(raw: str) -> list[dict]
    """Parse JSON array of repository objects."""

def parse_list_containers(raw: str) -> list[dict]
    """Parse JSON array of container objects."""

def parse_docker_ps(raw: str) -> list[dict]
    """Parse `docker ps` tabular output."""

def parse_docker_stats(raw: str) -> list[dict]
    """Parse `docker stats --no-stream` output."""

class AgentCommandParser:
    """Dispatch output parsing based on command type."""
    def parse(self, command: str, raw_output: str) -> list[dict] | None
```

#### `/backend/services/agent/registry.py` (~80 lines)

Read-only Redis operations for agent heartbeat status:

```python
class AgentRegistry:
    def __init__(self, redis_client):
        self.redis_client = redis_client

    def get_agent_status(self, agent_id: str) -> dict | None
    def list_agents(self) -> list[dict]
    def check_agent_online(self, agent_id: str, max_age: int = 90) -> bool
    def get_agent_containers(self, agent_id: str) -> list[dict]
    def get_agent_repositories(self, agent_id: str) -> list[dict]
```

**Redis keys:** `agents:{agent_id}` (hash)

#### `/backend/services/agent/commands.py` (~220 lines)

Pub/Sub command execution with DB tracking:

```python
class AgentCommands:
    def __init__(self, redis_client, repository: AgentRepository, parser: AgentCommandParser):
        self.redis_client = redis_client
        self.repository = repository
        self.parser = parser

    def send_command(self, agent_id: str, command: str, params: dict, sent_by: str) -> str
    def wait_for_response(self, agent_id: str, command_id: str, timeout: int = 30) -> dict
    def send_command_and_wait(self, agent_id: str, command: str, params: dict, sent_by: str, timeout: int = 30) -> dict
    def send_git_pull(self, agent_id: str, sent_by: str, timeout: int = 30) -> dict
    def send_docker_restart(self, agent_id: str, sent_by: str, timeout: int = 60) -> dict
```

**Redis channels:**
- Command: `datenschleuder-agent:{agent_id}` (publish)
- Response: `datenschleuder-agent-response:{agent_id}` (subscribe)

**Pattern:** Subscribe first (to avoid race conditions), then publish, then wait for match on command_id.

#### `/backend/services/agent/history.py` (~40 lines)

Simple DB delegation:

```python
class AgentHistory:
    def __init__(self, repository: AgentRepository):
        self.repository = repository

    def get_command_history(self, agent_id: str, limit: int = 50) -> list[dict]
    def get_all_command_history(self, limit: int = 100) -> list[dict]
```

#### `/backend/services/agent/__init__.py` — Facade

Maintains backward compatibility so `routers/agent.py` needs minimal changes:

```python
from .registry import AgentRegistry
from .commands import AgentCommands
from .history import AgentHistory
from .parsers import AgentCommandParser

class AgentService:
    """Unified facade combining all agent operations."""

    def __init__(self, db: Session):
        self.db = db
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        self.repository = AgentRepository(db)

        self._registry = AgentRegistry(self.redis_client)
        self._commands = AgentCommands(self.redis_client, self.repository, AgentCommandParser())
        self._history = AgentHistory(self.repository)

    # Delegate all methods
    def get_agent_status(self, agent_id): return self._registry.get_agent_status(agent_id)
    def list_agents(self): return self._registry.list_agents()
    def check_agent_online(self, agent_id, max_age=90): return self._registry.check_agent_online(agent_id, max_age)
    def get_agent_containers(self, agent_id): return self._registry.get_agent_containers(agent_id)
    def get_agent_repositories(self, agent_id): return self._registry.get_agent_repositories(agent_id)
    def send_command(self, *args, **kwargs): return self._commands.send_command(*args, **kwargs)
    def wait_for_response(self, *args, **kwargs): return self._commands.wait_for_response(*args, **kwargs)
    def send_command_and_wait(self, *args, **kwargs): return self._commands.send_command_and_wait(*args, **kwargs)
    def send_git_pull(self, *args, **kwargs): return self._commands.send_git_pull(*args, **kwargs)
    def send_docker_restart(self, *args, **kwargs): return self._commands.send_docker_restart(*args, **kwargs)
    def get_command_history(self, *args, **kwargs): return self._history.get_command_history(*args, **kwargs)
    def get_all_command_history(self, *args, **kwargs): return self._history.get_all_command_history(*args, **kwargs)
```

### Single Consumer

Only `/backend/routers/agent.py` imports from `agent_service.py`. With the facade, import changes are minimal:

```python
# Before:
from services.agent_service import AgentService

# After (works with either):
from services.agent import AgentService
# or keep old import if __init__.py re-exports
```

### Delete Old File

- Delete `/backend/services/agent_service.py`

---

## Step 3: Improve `repositories/auth/rbac_repository.py` (Optional)

### Current State

425 lines, 22 methods, manages 5 models (`Role`, `Permission`, `RolePermission`, `UserRole`, `UserPermission`).

**Design issues:**
1. Does NOT inherit from `BaseRepository` (all other repos do)
2. Manual session management repeated 22 times (opens/closes session in each method)
3. No `__all__` export

### Option A: Minimal Improvement (Recommended)

**Keep single file**, add section organization and docstring:

```python
class RBACRepository:
    """
    Repository for Role-Based Access Control operations.

    Manages 5 models across 5 logical sections:
    - Permission CRUD (methods: create_permission, get_permission, ...)
    - Role CRUD (methods: create_role, get_role, ...)
    - Role→Permission assignments
    - User→Role assignments
    - User→Permission overrides

    Note: Does not inherit BaseRepository because it manages
    multiple models. Uses manual session management.
    """
```

Add section comments:

```python
# ============================================================================
# Permission Operations
# ============================================================================

# ============================================================================
# Role Operations
# ============================================================================

# ============================================================================
# Role-Permission Assignments
# ============================================================================

# ============================================================================
# User-Role Assignments
# ============================================================================

# ============================================================================
# User-Permission Overrides
# ============================================================================
```

**Effort:** 30 minutes. No functional changes.

### Option B: Session Management Refactor (If time permits)

Replace 22 copies of manual session handling:

```python
# Before (repeated 22 times):
db = get_db_session()
try:
    # ... query logic
    db.commit()
    db.refresh(obj)
finally:
    db.close()

# After (context manager):
def _with_session(self, fn):
    db = get_db_session()
    try:
        result = fn(db)
        db.commit()
        return result
    finally:
        db.close()

# Usage:
def create_permission(self, resource, action, description=""):
    def _create(db):
        perm = Permission(resource=resource, action=action, description=description)
        db.add(perm)
        db.flush()
        db.refresh(perm)
        return perm
    return self._with_session(_create)
```

**Effort:** 2 hours. Reduces boilerplate but changes internal structure.

### Option C: Split into Multiple Repos (NOT Recommended)

Would create 3-5 small files for closely related operations. The 5 models are tightly coupled (e.g., assigning a permission to a role requires both Role and Permission). Splitting would add unnecessary indirection.

### Recommendation

Go with **Option A** (section comments + docstring). If Phase 1 refactored `rbac_manager.py` into `RBACService`, the service can gradually absorb business logic from the repository, making Option B less necessary.

---

## Execution Order

```
Step 1: Split core/models.py          → Highest impact, most files affected
  1a. Create core/models/ directory and base.py
  1b. Move models to domain files
  1c. Create __init__.py with re-exports
  1d. Verify Alembic, database.py, all imports
  1e. Delete old models.py

Step 2: Split agent_service.py         → Independent of Step 1
  2a. Create services/agent/ directory
  2b. Create parsers.py, registry.py, commands.py, history.py
  2c. Create __init__.py facade
  2d. Verify routers/agent.py works
  2e. Delete old agent_service.py

Step 3: Improve rbac_repository.py     → Optional, minimal effort
  3a. Add section comments and docstring
```

Steps 1 and 2 can be done in parallel (no dependencies).

---

## Verification Checklist

### After Step 1 (models split):

- [ ] `python -c "from core.models import User, NifiServer, JobRun, DatenschleuderAgentCommand"` succeeds
- [ ] `python -c "from core.models.auth import User, Role, Permission"` succeeds (new import path)
- [ ] `python -c "from core import models; print(len(models.__all__))"` prints 34
- [ ] `python -c "from core.models import Base; print(Base.metadata.tables.keys())"` lists all tables
- [ ] Alembic migration check passes (no missing tables)
- [ ] Application starts without import errors
- [ ] All 33 importing files work without modification
- [ ] Database reflection in `core/database.py` works correctly

### After Step 2 (agent service split):

- [ ] `python -c "from services.agent import AgentService"` succeeds
- [ ] `python -c "from services.agent.parsers import parse_git_status"` succeeds
- [ ] All agent API endpoints respond correctly
- [ ] Redis Pub/Sub still works (subscribe-first pattern preserved)
- [ ] Command history still persists to DB

### After Step 3 (RBAC repo):

- [ ] All RBAC API endpoints respond correctly
- [ ] Permission/role CRUD operations work

---

## Files Created (Summary)

```
NEW:
  core/models/__init__.py              (~50 lines, re-exports)
  core/models/base.py                  (~5 lines, shared Base)
  core/models/auth.py                  (~170 lines, 7 models)
  core/models/credentials.py           (~70 lines, 2 models)
  core/models/git.py                   (~40 lines, 1 model)
  core/models/jobs.py                  (~185 lines, 4 models)
  core/models/templates.py             (~105 lines, 2 models)
  core/models/settings.py              (~100 lines, 5 models)
  core/models/audit.py                 (~35 lines, 1 model)
  core/models/nifi.py                  (~265 lines, 9 models)
  core/models/pki.py                   (~90 lines, 2 models)
  core/models/agent.py                 (~25 lines, 1 model)
  services/agent/__init__.py           (~60 lines, facade)
  services/agent/parsers.py            (~120 lines, pure functions)
  services/agent/registry.py           (~80 lines)
  services/agent/commands.py           (~220 lines)
  services/agent/history.py            (~40 lines)

DELETED:
  core/models.py                       (1,177 lines)
  services/agent_service.py            (473 lines)

MODIFIED:
  repositories/auth/rbac_repository.py (section comments added)

NET: 1,650 lines deleted → ~1,660 lines created (neutral)
     But: 1 file with 1,177 lines → 12 files averaging 90 lines each
     And: 1 file with 473 lines → 5 files with clear single responsibilities
```
