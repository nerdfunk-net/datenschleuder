# Phase 4: Consolidate Pydantic Model Files

## Goal

Reduce fragmentation in `/backend/models/` by consolidating small, related Pydantic model files into cohesive domain modules. This improves discoverability and simplifies imports.

## Prerequisite

No strict dependency on Phases 1-3, but ideally done last since earlier phases may add or modify Pydantic models.

## Current State

23 Pydantic model files in `/backend/models/`:

| File | Lines | Classes | Status |
|---|---|---|---|
| `nifi_cluster.py` | 75 | 6 | FRAGMENTED — consolidate |
| `nifi_deployment.py` | 291 | 26 | FRAGMENTED — consolidate |
| `nifi_hierarchy.py` | 54 | 5 | FRAGMENTED — consolidate |
| `nifi_instance.py` | 76 | 4 | FRAGMENTED — consolidate |
| `nifi_operations.py` | 177 | 11 | FRAGMENTED — consolidate |
| `nifi_server.py` | 40 | 3 | FRAGMENTED — consolidate |
| `job_models.py` | 126 | ~6 | **DEAD CODE** (delete in Phase 1) |
| `job_templates.py` | 130 | ~5 | FRAGMENTED — consolidate |
| `jobs.py` | 185 | ~8 | FRAGMENTED — consolidate |
| `agent.py` | 97 | — | OK — single domain |
| `auth.py` | 109 | — | OK — single domain |
| `cert_manager.py` | 161 | — | OK — separate feature |
| `common.py` | 38 | 1 | OK — shared envelope |
| `credentials.py` | 60 | — | OK — single domain |
| `files.py` | 25 | 2 | OK — minimal |
| `git.py` | 272 | — | OK — operational models |
| `git_repositories.py` | 147 | — | OK — config models |
| `pki.py` | 119 | — | OK — separate feature |
| `rbac.py` | 75+ | — | OK — single domain |
| `settings.py` | 80+ | — | OK — single domain |
| `templates.py` | 90+ | — | OK — single domain |
| `user_management.py` | 75+ | — | OK — single domain |
| `__init__.py` | ~5 | — | Package init |

---

## Step 1: Consolidate NiFi Pydantic Models (Primary)

### Current State

6 files, 713 lines, 54 Pydantic classes spread across:

| File | Lines | Classes | Primary Consumer(s) |
|---|---|---|---|
| `nifi_server.py` | 40 | 3 | `routers/nifi/nifi_config.py`, `services/nifi/nifi_config_service.py` |
| `nifi_instance.py` | 76 | 4 | `routers/nifi/instances.py`, `services/nifi/nifi_config_service.py` |
| `nifi_cluster.py` | 75 | 6 | `routers/nifi/nifi_config.py`, `services/nifi/nifi_config_service.py` |
| `nifi_hierarchy.py` | 54 | 5 | `routers/nifi/hierarchy.py` |
| `nifi_operations.py` | 177 | 11 | `routers/nifi/nifi_flows.py`, `routers/nifi/registry_flows.py`, `routers/nifi/flow_views.py` |
| `nifi_deployment.py` | 291 | 26 | `routers/nifi/operations.py`, `routers/nifi/deploy.py` |

**Key finding:** Zero cross-references between NiFi model files. Each file is completely independent — no imports from one nifi_*.py to another.

### Target

**Create: `/backend/models/nifi.py`** (~713 lines, 54 classes)

Organized with clear section headers:

```python
"""
NiFi Pydantic Models

All request/response schemas for NiFi operations.
Organized by domain:
  - Server Models
  - Instance Models
  - Cluster Models
  - Hierarchy Models
  - Flow & Registry Models
  - Deployment & Operations Models
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any
from datetime import datetime

# ============================================================================
# Server Models (from nifi_server.py)
# ============================================================================

class NifiServerCreate(BaseModel):
    ...

class NifiServerUpdate(BaseModel):
    ...

class NifiServerResponse(BaseModel):
    ...

# ============================================================================
# Instance Models (from nifi_instance.py)
# ============================================================================

class NifiInstanceCreate(BaseModel):
    ...

class NifiInstanceUpdate(BaseModel):
    ...

class NifiInstanceResponse(BaseModel):
    ...

class NifiInstanceTestConnection(BaseModel):
    ...

# ============================================================================
# Cluster Models (from nifi_cluster.py)
# ============================================================================

class NifiClusterMemberInput(BaseModel):
    ...

class NifiClusterCreate(BaseModel):
    ...

class NifiClusterUpdate(BaseModel):
    ...

class NifiClusterMemberResponse(BaseModel):
    ...

class NifiClusterResponse(BaseModel):
    ...

class NifiClusterPrimaryResponse(BaseModel):
    ...

# ============================================================================
# Hierarchy Models (from nifi_hierarchy.py)
# ============================================================================

class HierarchyValueCreate(BaseModel):
    ...

class HierarchyValueResponse(BaseModel):
    ...

class HierarchyValuesRequest(BaseModel):
    ...

class HierarchyAttribute(BaseModel):
    ...

class HierarchyConfig(BaseModel):
    ...

# ============================================================================
# Flow & Registry Models (from nifi_operations.py)
# ============================================================================

# NiFi Flows
class NifiFlowCreate(BaseModel):
    ...

class NifiFlowUpdate(BaseModel):
    ...

class NifiFlowResponse(BaseModel):
    ...

# Registry Flows
class RegistryFlowCreate(BaseModel):
    ...

class RegistryFlowResponse(BaseModel):
    ...

# Flow Views
class FlowViewCreate(BaseModel):
    ...

class FlowViewUpdate(BaseModel):
    ...

class FlowViewResponse(BaseModel):
    ...

# Registry Flow Metadata
class RegistryFlowMetadataItem(BaseModel):
    ...

class RegistryFlowMetadataResponse(BaseModel):
    ...

class RegistryFlowMetadataSetRequest(BaseModel):
    ...

# ============================================================================
# Deployment & Operations Models (from nifi_deployment.py)
# ============================================================================

class DeploymentRequest(BaseModel):
    ...

class DeploymentResponse(BaseModel):
    ...

# ... (remaining 24 deployment classes)
```

### Import Updates Required

9 files need import path changes:

#### 1. `/backend/routers/nifi/nifi_config.py` (lines 14-20)

```python
# Before:
from models.nifi_cluster import NifiClusterCreate, NifiClusterUpdate, NifiClusterResponse, NifiClusterPrimaryResponse
from models.nifi_server import NifiServerCreate, NifiServerUpdate, NifiServerResponse
from models.nifi_instance import NifiInstanceResponse

# After:
from models.nifi import (
    NifiClusterCreate, NifiClusterUpdate, NifiClusterResponse, NifiClusterPrimaryResponse,
    NifiServerCreate, NifiServerUpdate, NifiServerResponse,
    NifiInstanceResponse,
)
```

#### 2. `/backend/routers/nifi/operations.py` (lines 11-22)

```python
# Before:
from models.nifi_deployment import (
    ParameterContextListResponse, ParameterContextCreate, ParameterContextUpdate,
    ProcessorConfigurationResponse, ProcessorConfigurationUpdate,
    ProcessorConfigurationUpdateResponse, AssignParameterContextRequest,
    AssignParameterContextResponse, ConnectionRequest, ConnectionResponse,
)

# After:
from models.nifi import (
    ParameterContextListResponse, ParameterContextCreate, ParameterContextUpdate,
    ProcessorConfigurationResponse, ProcessorConfigurationUpdate,
    ProcessorConfigurationUpdateResponse, AssignParameterContextRequest,
    AssignParameterContextResponse, ConnectionRequest, ConnectionResponse,
)
```

#### 3. `/backend/routers/nifi/deploy.py` (line 7)

```python
# Before:
from models.nifi_deployment import DeploymentRequest, DeploymentResponse

# After:
from models.nifi import DeploymentRequest, DeploymentResponse
```

#### 4. `/backend/routers/nifi/instances.py` (lines 8-13)

```python
# Before:
from models.nifi_instance import NifiInstanceCreate, NifiInstanceUpdate, NifiInstanceResponse, NifiInstanceTestConnection

# After:
from models.nifi import NifiInstanceCreate, NifiInstanceUpdate, NifiInstanceResponse, NifiInstanceTestConnection
```

#### 5. `/backend/routers/nifi/hierarchy.py` (line 7)

```python
# Before:
from models.nifi_hierarchy import HierarchyConfig, HierarchyValuesRequest

# After:
from models.nifi import HierarchyConfig, HierarchyValuesRequest
```

#### 6. `/backend/routers/nifi/nifi_flows.py`

```python
# Before:
from models.nifi_operations import NifiFlowCreate, NifiFlowUpdate, NifiFlowResponse

# After:
from models.nifi import NifiFlowCreate, NifiFlowUpdate, NifiFlowResponse
```

#### 7. `/backend/routers/nifi/registry_flows.py`

```python
# Before:
from models.nifi_operations import (
    RegistryFlowCreate, RegistryFlowResponse,
    RegistryFlowMetadataItem, RegistryFlowMetadataResponse, RegistryFlowMetadataSetRequest,
)

# After:
from models.nifi import (
    RegistryFlowCreate, RegistryFlowResponse,
    RegistryFlowMetadataItem, RegistryFlowMetadataResponse, RegistryFlowMetadataSetRequest,
)
```

#### 8. `/backend/routers/nifi/flow_views.py`

```python
# Before:
from models.nifi_operations import FlowViewCreate, FlowViewUpdate, FlowViewResponse

# After:
from models.nifi import FlowViewCreate, FlowViewUpdate, FlowViewResponse
```

#### 9. `/backend/services/nifi/nifi_config_service.py` (lines 11-19)

```python
# Before:
from models.nifi_server import NifiServerCreate, NifiServerUpdate, NifiServerResponse
from models.nifi_instance import NifiInstanceResponse
from models.nifi_cluster import (
    NifiClusterCreate, NifiClusterUpdate, NifiClusterMemberResponse,
    NifiClusterResponse, NifiClusterPrimaryResponse,
)

# After:
from models.nifi import (
    NifiServerCreate, NifiServerUpdate, NifiServerResponse,
    NifiInstanceResponse,
    NifiClusterCreate, NifiClusterUpdate, NifiClusterMemberResponse,
    NifiClusterResponse, NifiClusterPrimaryResponse,
)
```

### Files to Delete

After consolidation, delete the 6 old files:

- `/backend/models/nifi_cluster.py`
- `/backend/models/nifi_deployment.py`
- `/backend/models/nifi_hierarchy.py`
- `/backend/models/nifi_instance.py`
- `/backend/models/nifi_operations.py`
- `/backend/models/nifi_server.py`

### Impact

- **54 class names remain identical** — no API contract changes
- **9 files updated** — only import paths change
- **Zero functional changes** — pure refactoring
- **6 files deleted** — cleaner directory
- **1 file created** — single source of truth for NiFi schemas

---

## Step 2: Consolidate Job Pydantic Models (Secondary)

### Current State

After Phase 1 deletes `job_models.py` (dead code), 2 files remain:

| File | Lines | Classes | Consumer |
|---|---|---|---|
| `job_templates.py` | 130 | ~5 | `routers/jobs/templates.py` |
| `jobs.py` | 185 | ~8 | `routers/jobs/runs.py`, `routers/jobs/schedules.py` |

### Target

**Create: `/backend/models/jobs.py`** (rename/expand existing `jobs.py`)

Merge `job_templates.py` content into `jobs.py` with section headers:

```python
"""
Job Pydantic Models

All request/response schemas for job operations.
Organized by domain:
  - Job Template Models
  - Job Schedule Models
  - Job Run Models
  - Job Execution Models
"""

# ============================================================================
# Job Template Models (from job_templates.py)
# ============================================================================

class JobTemplateBase(BaseModel):
    ...

class JobTemplateCreate(JobTemplateBase):
    ...

class JobTemplateUpdate(BaseModel):
    ...

class JobTemplateResponse(JobTemplateBase):
    ...

# ============================================================================
# Job Schedule Models
# ============================================================================

class JobScheduleCreate(BaseModel):
    ...

# ... (existing classes from jobs.py)

# ============================================================================
# Job Run Models
# ============================================================================

class JobRunResponse(BaseModel):
    ...

# ============================================================================
# Job Execution Models
# ============================================================================

class JobExecutionRequest(BaseModel):
    ...
```

### Import Updates Required

Only files importing from `job_templates.py` need changes:

```python
# Before:
from models.job_templates import JobTemplateCreate, JobTemplateUpdate, JobTemplateResponse

# After:
from models.jobs import JobTemplateCreate, JobTemplateUpdate, JobTemplateResponse
```

**Affected files:**
- `/backend/routers/jobs/templates.py`
- Any service files importing job template models

### Files to Delete

- `/backend/models/job_templates.py` (content merged into `jobs.py`)
- `/backend/models/job_models.py` (already deleted in Phase 1 Step 0)

---

## What NOT to Consolidate

The analysis identified these groups as **already well-organized** — no changes needed:

| Group | Files | Reason to Keep Separate |
|---|---|---|
| **Git** | `git.py` (272 lines), `git_repositories.py` (147 lines) | Different purposes: operational models vs. config models |
| **PKI/Cert** | `cert_manager.py` (161 lines), `pki.py` (119 lines) | Different features: NiFi cert management vs. standalone PKI |
| **Auth** | `auth.py` (109 lines) | Single file, appropriate size |
| **Agent** | `agent.py` (97 lines) | Single file, appropriate size |
| **Credentials** | `credentials.py` (60 lines) | Single file, appropriate size |
| **RBAC** | `rbac.py` (75+ lines) | Single file, appropriate size |
| **Settings** | `settings.py` (80+ lines) | Single file, appropriate size |
| **Templates** | `templates.py` (90+ lines) | Single file, appropriate size |
| **User Management** | `user_management.py` (75+ lines) | Single file, appropriate size |
| **Common** | `common.py` (38 lines) | Shared across modules |
| **Files** | `files.py` (25 lines) | Minimal, focused |

---

## Execution Order

```
Step 1: NiFi consolidation        → Largest impact (6 files → 1)
Step 2: Job model consolidation   → Secondary (2 files → 1, after Phase 1 deletes dead code)
```

---

## Verification Checklist

### After Step 1 (NiFi consolidation):

- [ ] `python -c "from models.nifi import NifiServerCreate, DeploymentRequest, HierarchyConfig"` succeeds
- [ ] All 54 NiFi Pydantic classes importable from `models.nifi`
- [ ] All NiFi API endpoints respond correctly
- [ ] No import errors in any router or service file
- [ ] Old files deleted: nifi_cluster.py, nifi_deployment.py, nifi_hierarchy.py, nifi_instance.py, nifi_operations.py, nifi_server.py
- [ ] `grep -r "from models.nifi_" backend/` returns zero results

### After Step 2 (Job consolidation):

- [ ] `python -c "from models.jobs import JobTemplateCreate, JobScheduleCreate, JobRunResponse"` succeeds
- [ ] All job API endpoints respond correctly
- [ ] `grep -r "from models.job_templates" backend/` returns zero results
- [ ] `grep -r "from models.job_models" backend/` returns zero results

---

## Files Summary

```
NEW:
  models/nifi.py                    (~713 lines, 54 classes)

MODIFIED:
  models/jobs.py                    (expanded from ~185 to ~315 lines)
  routers/nifi/nifi_config.py       (import update)
  routers/nifi/operations.py        (import update)
  routers/nifi/deploy.py            (import update)
  routers/nifi/instances.py         (import update)
  routers/nifi/hierarchy.py         (import update)
  routers/nifi/nifi_flows.py        (import update)
  routers/nifi/registry_flows.py    (import update)
  routers/nifi/flow_views.py        (import update)
  services/nifi/nifi_config_service.py (import update)
  routers/jobs/templates.py         (import update)

DELETED:
  models/nifi_cluster.py            (75 lines)
  models/nifi_deployment.py         (291 lines)
  models/nifi_hierarchy.py          (54 lines)
  models/nifi_instance.py           (76 lines)
  models/nifi_operations.py         (177 lines)
  models/nifi_server.py             (40 lines)
  models/job_templates.py           (130 lines)
  models/job_models.py              (126 lines — dead code, deleted in Phase 1)

NET: 8 files deleted → 1 created + 1 expanded
     /backend/models/ directory: 23 files → 16 files (30% fewer)
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Missing class in consolidated file | LOW | MEDIUM | Count: 54 NiFi classes, verify all present |
| Import path missed in update | LOW | LOW | `grep -r "nifi_cluster\|nifi_deployment\|nifi_hierarchy\|nifi_instance\|nifi_operations\|nifi_server" backend/` |
| Pydantic validator breaks when moved | VERY LOW | MEDIUM | Run endpoint tests — validators are self-contained |
| Class name collision | VERY LOW | HIGH | All 54 names already unique across files |
| File too large (713 lines) | LOW | LOW | Well-organized with section headers; IDE navigation works fine |
