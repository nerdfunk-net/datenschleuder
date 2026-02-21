# REST API Comparison: Old vs. New Backend

This document compares the old backend API (port 8001, located at `./old_code/backend/`) with the new backend API (port 8000, located at `./backend/`), with a focus on NiFi-related endpoints.

---

## Overview

| Aspect | Old API | New API |
|---|---|---|
| Total endpoints | ~117 | ~264 |
| Architecture | Flat, monolithic | Layered (Model → Repository → Service → Router) |
| NiFi routing pattern | Multiple separate prefixes | Unified under `/api/nifi/*` |
| Auth pattern | `verify_token` (generic) | `require_permission("resource", "action")` |
| Settings location | `/api/settings/*` | Mixed: `/api/nifi/hierarchy/*` (NiFi), `/api/settings/*` (others) |
| OIDC support | No | Yes (`/api/nifi/instances/oidc-providers`) |
| Dynamic schema | Yes (`recreate-table`) | No (fixed schema) |

---

## URL Structure Changes

The most significant change is the reorganization of NiFi endpoints from a flat, fragmented structure into a unified hierarchical structure.

### Old API Path Prefixes (NiFi)

```
/api/nifi/*                  → Core NiFi check-connection
/api/nifi-instances/*        → Instance CRUD + monitoring
/api/nifi-flows/*            → Flow records + table management
/api/nifi-install/*          → Install utilities
/api/flow-views/*            → UI preferences
/api/registry-flows/*        → Registry flow records
/api/settings/nifi           → NiFi connection settings
/api/settings/registry       → Registry settings
/api/settings/hierarchy/*    → Hierarchy + attribute values
/api/settings/deploy         → Deployment settings
/api/deploy/{id}/flow        → Flow deployment
```

### New API Path Prefixes (NiFi)

```
/api/nifi/instances/*                    → Instance CRUD + test connection + OIDC providers
/api/nifi/instances/{id}/ops/*           → All live NiFi operations (registries, parameters, process groups, processors)
/api/nifi/instances/{id}/deploy          → Flow deployment
/api/nifi/flows/*                        → Local flow records
/api/nifi/registry-flows/*               → Registry flow records
/api/nifi/flow-views/*                   → UI preferences
/api/nifi/hierarchy/*                    → Hierarchy + attribute values + deploy settings
/api/nifi/certificates/*                 → Certificates
/api/nifi/install/*                      → Install utilities
```

---

## NiFi Endpoint Mapping (Old → New)

### Instance Management

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/nifi-instances/` | `GET /api/nifi/instances/` | Same behavior |
| `POST /api/nifi-instances/` | `POST /api/nifi/instances/` | Same behavior |
| `PUT /api/nifi-instances/{id}` | `PUT /api/nifi/instances/{id}` | Same behavior |
| `DELETE /api/nifi-instances/{id}` | `DELETE /api/nifi/instances/{id}` | Same behavior |
| `POST /api/nifi-instances/test` | `POST /api/nifi/instances/test` | Same behavior |
| `POST /api/nifi-instances/{id}/test-connection` | `POST /api/nifi/instances/{id}/test-connection` | Same behavior |
| `POST /api/nifi/check-connection` | *(not present)* | Old checked stored settings; new uses instance-specific test |
| *(not present)* | `GET /api/nifi/instances/oidc-providers` | **New**: Lists available OIDC providers for backend auth |

### Instance Monitoring / System Info

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/nifi-instances/{id}/get-system-diagnostics` | `GET /api/nifi/instances/{id}/ops/system-diagnostics` | Same purpose, new path under `/ops/` |
| `GET /api/nifi-instances/{id}/get-cluster` | *(not present)* | **Missing in new API** |
| `GET /api/nifi-instances/{id}/get-nifi-version` | *(not present)* | **Missing in new API** |
| `GET /api/nifi-instances/{id}/get-node/{node_id}` | *(not present)* | **Missing in new API** |
| `GET /api/nifi-instances/{id}/get-root` | *(via process-group lookup)* | Covered by `GET /ops/process-group` with root id |
| `GET /api/nifi-instances/{id}/get-all-paths` | `GET /api/nifi/instances/{id}/ops/process-groups/all-paths` | Same behavior |
| `GET /api/nifi-instances/{id}/process-group/{pg_id}/status` | `GET /api/nifi/instances/{id}/ops/process-groups/{pg_id}/status` | Same behavior |

### Registries

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `POST /api/nifi/{id}/get-registries` | `GET /api/nifi/instances/{id}/ops/registries` | Method changed POST→GET |
| `GET /api/nifi/{id}/registry/{rid}/get-buckets` | `GET /api/nifi/instances/{id}/ops/registries/{rid}/buckets` | Cleaner path |
| `GET /api/nifi/{id}/registry/{rid}/details` | `GET /api/nifi/instances/{id}/ops/registries/{rid}/details` | Same behavior |
| `GET /api/nifi/{id}/registry/{rid}/get-flows` | `GET /api/nifi/instances/{id}/ops/registries/{rid}/buckets/{bid}/flows` | Bucket now explicit in path |
| `GET /api/nifi/{id}/registry/{rid}/get-versions` | `GET /api/nifi/instances/{id}/ops/registries/{rid}/buckets/{bid}/flows/{fid}/versions` | More explicit path |
| `GET /api/nifi/{id}/registry/{rid}/export-flow` | `GET /api/nifi/instances/{id}/ops/registries/{rid}/buckets/{bid}/export-flow` | Same behavior |
| `POST /api/nifi/{id}/registry/{rid}/import-flow` | `POST /api/nifi/instances/{id}/ops/registries/{rid}/buckets/{bid}/import-flow` | Same behavior |

### Parameter Contexts

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/nifi/{id}/get-parameters` | `GET /api/nifi/instances/{id}/ops/parameters` | Same behavior |
| `GET /api/nifi/{id}/parameter-contexts/{cid}` | `GET /api/nifi/instances/{id}/ops/parameter-contexts/{cid}` | Same behavior |
| `POST /api/nifi/{id}/parameter-contexts` | `POST /api/nifi/instances/{id}/ops/parameter-contexts` | Same behavior |
| `PUT /api/nifi/{id}/parameter-contexts/{cid}` | `PUT /api/nifi/instances/{id}/ops/parameter-contexts/{cid}` | Same behavior |
| `DELETE /api/nifi/{id}/parameter-contexts/{cid}` | `DELETE /api/nifi/instances/{id}/ops/parameter-contexts/{cid}` | Same behavior |
| `POST /api/nifi/{id}/add-parameter` | `POST /api/nifi/instances/{id}/ops/process-groups/{pg_id}/assign-parameter-context` | Refactored to explicit resource action |

### Process Groups

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/nifi/{id}/process-group` | `GET /api/nifi/instances/{id}/ops/process-group` | Same behavior |
| `GET /api/nifi/{id}/process-groups` | `GET /api/nifi/instances/{id}/ops/process-groups/{pg_id}/children` | Child listing now explicit |
| `GET /api/nifi/{id}/get-path` | *(covered by all-paths)* | Use `all-paths` with filtering |
| `GET /api/nifi/{id}/get-all-paths` | `GET /api/nifi/instances/{id}/ops/process-groups/all-paths` | Same behavior |
| `GET /api/nifi/{id}/process-group/{pg_id}/output-ports` | `GET /api/nifi/instances/{id}/ops/process-groups/{pg_id}/output-ports` | Same behavior |
| `GET /api/nifi/{id}/process-group/{pg_id}/input-ports` | `GET /api/nifi/instances/{id}/ops/process-groups/{pg_id}/input-ports` | Same behavior |
| `GET /api/nifi/{id}/process-group/{pg_id}/processors` | `GET /api/nifi/instances/{id}/ops/process-groups/{pg_id}/processors` | Same behavior |
| `POST /api/nifi/{id}/process-group/{pg_id}/start` | *(not present)* | **Missing in new API** |
| `POST /api/nifi/{id}/process-group/{pg_id}/stop` | *(not present)* | **Missing in new API** |
| `POST /api/nifi/{id}/process-group/{pg_id}/enable` | *(not present)* | **Missing in new API** |
| `POST /api/nifi/{id}/process-group/{pg_id}/disable` | *(not present)* | **Missing in new API** |
| `DELETE /api/nifi/{id}/process-group/{pg_id}` | *(not present)* | **Missing in new API** |
| `POST /api/nifi/{id}/process-group/{pg_id}/update-version` | `POST /api/nifi/instances/{id}/ops/process-groups/{pg_id}/update-version` | Same behavior |
| `POST /api/nifi/{id}/process-group/{pg_id}/stop-versioning` | `POST /api/nifi/instances/{id}/ops/process-groups/{pg_id}/stop-versioning` | Same behavior |

### Processors

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/nifi/{id}/processor/{pid}/configuration` | `GET /api/nifi/instances/{id}/ops/processors/{pid}/configuration` | Same behavior |
| `PUT /api/nifi/{id}/processor/{pid}/configuration` | `PUT /api/nifi/instances/{id}/ops/processors/{pid}/configuration` | Same behavior |

### Connections & Components

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `POST /api/nifi/{id}/connection` | `POST /api/nifi/instances/{id}/ops/process-groups/{pg_id}/connections` | Process group now explicit in path |
| `GET /api/nifi/{id}/all-connections` | *(not present)* | **Missing in new API** — use `GET /ops/components?kind=connection` |
| `GET /api/nifi/{id}/component-connection` | *(not present)* | **Missing in new API** — use `GET /ops/components` with filtering |
| `GET /api/nifi/{id}/list-all-by-kind` | `GET /api/nifi/instances/{id}/ops/components` | Same purpose, cleaner name |

### Local Flow Records

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/nifi-flows/` | `GET /api/nifi/flows/` | Same behavior |
| `POST /api/nifi-flows/` | `POST /api/nifi/flows/` | Same behavior |
| `PUT /api/nifi-flows/{id}` | `PUT /api/nifi/flows/{id}` | Same behavior |
| `DELETE /api/nifi-flows/{id}` | `DELETE /api/nifi/flows/{id}` | Same behavior |
| `POST /api/nifi-flows/{id}/copy` | `POST /api/nifi/flows/{id}/copy` | Same behavior |
| `GET /api/nifi-flows/table-info` | *(not present)* | **Missing in new API** — schema is now fixed |
| `POST /api/nifi-flows/recreate-table` | *(not present)* | **Missing in new API** — dynamic table recreation removed |
| *(not present)* | `GET /api/nifi/flows/columns` | **New**: Returns column metadata for the flows table |

### Registry Flow Records (Local DB)

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/registry-flows/` | `GET /api/nifi/registry-flows/` | Same behavior, moved under `/api/nifi/` |
| `POST /api/registry-flows/` | `POST /api/nifi/registry-flows/` | Same behavior |
| `GET /api/registry-flows/{id}` | `GET /api/nifi/registry-flows/{id}` | Same behavior |
| `DELETE /api/registry-flows/{id}` | `DELETE /api/nifi/registry-flows/{id}` | Same behavior |
| *(not present)* | `GET /api/nifi/registry-flows/templates/list` | **New**: Filtered list for template selection UI |

### Flow Views

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/flow-views/` | `GET /api/nifi/flow-views/` | Same behavior, moved under `/api/nifi/` |
| `POST /api/flow-views/` | `POST /api/nifi/flow-views/` | Same behavior |
| `GET /api/flow-views/{id}` | `GET /api/nifi/flow-views/{id}` | Same behavior |
| `PUT /api/flow-views/{id}` | `PUT /api/nifi/flow-views/{id}` | Same behavior |
| `DELETE /api/flow-views/{id}` | `DELETE /api/nifi/flow-views/{id}` | Same behavior |
| `POST /api/flow-views/{id}/set-default` | `POST /api/nifi/flow-views/{id}/set-default` | Same behavior |

### Hierarchy & Settings

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/settings/nifi` | *(not present)* | **Missing in new API** — stored settings replaced by instance model |
| `POST /api/settings/nifi` | *(not present)* | **Missing in new API** |
| `GET /api/settings/registry` | *(not present)* | **Missing in new API** — registry config is per-instance |
| `POST /api/settings/registry` | *(not present)* | **Missing in new API** |
| `GET /api/settings/hierarchy` | `GET /api/nifi/hierarchy/` | Moved under `/api/nifi/` |
| `POST /api/settings/hierarchy` | `POST /api/nifi/hierarchy/` | Moved under `/api/nifi/` |
| `GET /api/settings/hierarchy/values/{attr}` | `GET /api/nifi/hierarchy/values/{attr}` | Moved under `/api/nifi/` |
| `POST /api/settings/hierarchy/values` | `POST /api/nifi/hierarchy/values` | Moved under `/api/nifi/` |
| `DELETE /api/settings/hierarchy/values/{attr}` | `DELETE /api/nifi/hierarchy/values/{attr}` | Moved under `/api/nifi/` |
| `GET /api/settings/deploy` | `GET /api/nifi/hierarchy/deploy` | Moved and grouped under hierarchy |
| `POST /api/settings/deploy` | `POST /api/nifi/hierarchy/deploy` | Moved and grouped under hierarchy |
| *(not present)* | `GET /api/nifi/hierarchy/flow-count` | **New**: Returns current flow count |

### Deployment

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `POST /api/deploy/{id}/flow` | `POST /api/nifi/instances/{id}/deploy` | Moved under instances, cleaner resource structure |

### Installation

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `GET /api/nifi-install/check-path` | `GET /api/nifi/install/check-path` | Same behavior, moved under `/api/nifi/` |
| `POST /api/nifi-install/create-groups` | *(not present)* | **Missing in new API** — creates missing process groups with auto-port-connection |

### Certificates (New Only)

| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| *(not present)* | `GET /api/nifi/certificates/` | **New**: Lists available TLS certificates for NiFi instances |

---

## Endpoints Missing in New API

These endpoints exist in the old API but have no equivalent in the new API:

| Old Endpoint | Category | Impact |
|---|---|---|
| `POST /api/nifi/check-connection` | Connectivity | Low — per-instance `test-connection` covers the use case |
| `GET /api/nifi-instances/{id}/get-cluster` | Monitoring | **High** — cluster topology not accessible in new API |
| `GET /api/nifi-instances/{id}/get-nifi-version` | Monitoring | Medium — version info lost |
| `GET /api/nifi-instances/{id}/get-node/{node_id}` | Monitoring | **High** — individual node diagnostics not accessible |
| `POST /api/nifi/{id}/process-group/{pg_id}/start` | Operations | **High** — can't start process groups |
| `POST /api/nifi/{id}/process-group/{pg_id}/stop` | Operations | **High** — can't stop process groups |
| `POST /api/nifi/{id}/process-group/{pg_id}/enable` | Operations | Medium |
| `POST /api/nifi/{id}/process-group/{pg_id}/disable` | Operations | Medium |
| `DELETE /api/nifi/{id}/process-group/{pg_id}` | Operations | Medium — lifecycle management incomplete |
| `GET /api/nifi/{id}/all-connections` | Data Access | Low — partially covered by `GET /ops/components` |
| `GET /api/nifi/{id}/component-connection` | Data Access | Low — partially covered by `GET /ops/components` |
| `GET /api/nifi-flows/table-info` | Schema | Low — new API has fixed schema |
| `POST /api/nifi-flows/recreate-table` | Schema | Low — dynamic schema removed by design |
| `POST /api/nifi-install/create-groups` | Provisioning | **High** — automated process group creation missing |
| `GET /api/settings/nifi` | Configuration | Medium — replaced by instance model |
| `POST /api/settings/nifi` | Configuration | Medium — replaced by instance model |
| `GET /api/settings/registry` | Configuration | Medium — now per-instance |
| `POST /api/settings/registry` | Configuration | Medium — now per-instance |

---

## Endpoints New in New API (Not in Old)

| New Endpoint | Category | Description |
|---|---|---|
| `GET /api/nifi/instances/oidc-providers` | Auth | Lists OIDC providers available for backend authentication |
| `GET /api/nifi/certificates/` | Security | Lists TLS certificates for NiFi instances |
| `GET /api/nifi/registry-flows/templates/list` | Flows | Filtered list for template selection UI |
| `GET /api/nifi/flows/columns` | Schema | Returns column metadata for the flows table |
| `GET /api/nifi/hierarchy/flow-count` | Hierarchy | Returns current flow count |
| Full RBAC at `/api/rbac/*` | Auth | Users, roles, permissions management |
| Job system at `/api/job-templates/*`, `/api/job-runs/*` | Automation | Job template execution |
| Git integration at `/api/git-repositories/*` | VCS | Git repository management |
| Celery tasks at `/api/celery/*` | Background | Task queue management |
| Templates at `/api/templates/*` | Config | Configuration template management |

---

## Authentication & Permission Changes

### Old API
```python
# All endpoints use generic token verification
@router.get("/some-endpoint")
async def endpoint(user: dict = Depends(verify_token)):
    ...
```

### New API
```python
# Granular permissions per endpoint
@router.get("/some-endpoint", dependencies=[Depends(require_permission("nifi", "read"))])
async def endpoint(user: dict = Depends(verify_token)):
    ...
```

**New Permission Scopes for NiFi:**
- `nifi:read` — Read operations (list, get)
- `nifi:write` — Create and update operations
- `nifi:delete` — Delete operations
- `nifi.settings:write` — Hierarchy and deployment settings
- `nifi.deploy:write` — Flow deployment

---

## Architecture Differences

### Old Backend
- Settings stored in a key-value `Setting` model with JSON values
- NiFi connection config stored in flat settings, not per-instance
- `nifi_flows` table schema created dynamically via raw SQL based on hierarchy config (`recreate-table`)
- NiFi operations called directly from routers via nipyapi
- No service layer — business logic in route handlers

### New Backend
- Full layered architecture: Model → Repository → Service → Router
- NiFi config is per-instance (`NifiInstance` model with full credentials and auth options)
- Fixed `nifi_flows` table schema — no dynamic DDL
- Operations go through service layer (`instance_service`, `deploy_service`, etc.)
- OIDC provider support integrated into instance model
- Retry logic for transient connection errors
- Deployment as a dedicated service (`deploy_service`)

---

## Frontend Settings Pages — Affected Components

The following frontend settings pages currently talk to old-API-style endpoints. They map to new endpoints as follows:

| Settings Page | Old Path | New Path |
|---|---|---|
| NiFi Instances | `/api/nifi-instances/*` | `/api/nifi/instances/*` |
| Registry Flows | `/api/registry-flows/*` | `/api/nifi/registry-flows/*` |
| Hierarchy | `/api/settings/hierarchy/*` | `/api/nifi/hierarchy/*` |
| Deploy Settings | `/api/settings/deploy` | `/api/nifi/hierarchy/deploy` |

The frontend files in `frontend/src/components/features/settings/` that have uncommitted changes (`git status`) are likely already partially updated to use the new paths.
