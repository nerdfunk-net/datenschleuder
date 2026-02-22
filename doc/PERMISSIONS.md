# RBAC Permission System

This document is the authoritative reference for all RBAC permissions, roles, router protection status, and known gaps in Cockpit-NG. Keep this file up to date when adding or changing endpoints.

Last updated: 2026-02-22

---

## How the system works

Permissions follow the format `resource:action`. Every protected endpoint declares one required permission via the `require_permission(resource, action)` FastAPI dependency in [backend/core/auth.py](../backend/core/auth.py). The dependency resolves the user ID from the JWT token, looks up the permission in the database, checks role-based and per-user overrides, and raises 403 if the user does not have it.

Resolution order inside `has_permission()` ([backend/rbac_manager.py](../backend/rbac_manager.py)):

1. Per-user permission override (highest priority)
2. Role-based permissions
3. Default deny

Important: if a permission does not exist in the database it always resolves to False, even for admins. Admins gain access because all existing seeded permissions are assigned to the admin role — not because there is a bypass.

Available helper dependencies:

| Dependency | Description |
|---|---|
| `require_permission(resource, action)` | Exact permission match required |
| `require_any_permission(resource, actions)` | Any one of the listed actions |
| `require_all_permissions(resource, actions)` | All listed actions required |
| `require_role(role_name)` | Role membership check |
| `verify_token` | JWT validation only — any authenticated user |

---

## Seeded permissions (46 total)

Defined in [backend/tools/seed_rbac.py](../backend/tools/seed_rbac.py). Run this script when setting up a new instance or after resetting the database.

### Dashboard

| Permission | Description |
|---|---|
| `dashboard.settings:read` | Access to Settings menu and pages |

### Git

| Permission | Description |
|---|---|
| `git.repositories:read` | View git repositories |
| `git.repositories:write` | Create/modify git repositories |
| `git.repositories:delete` | Delete git repositories |
| `git.operations:execute` | Execute git operations (commit, push, pull) |

### Settings

| Permission | Description |
|---|---|
| `settings.git:read` | View git settings |
| `settings.git:write` | Modify git settings |
| `settings.cache:read` | View cache settings |
| `settings.cache:write` | Modify cache and manage cache entries |
| `settings.celery:read` | View Celery task queue status |
| `settings.celery:write` | Manage Celery tasks and workers |
| `settings.credentials:read` | View credentials |
| `settings.credentials:write` | Create/modify credentials |
| `settings.credentials:delete` | Delete credentials |
| `settings.common:read` | View common settings |
| `settings.common:write` | Modify common settings |

### User management

| Permission | Description |
|---|---|
| `users:read` | View users |
| `users:write` | Create/modify users |
| `users:delete` | Delete users |
| `users.roles:write` | Assign roles to users |
| `users.permissions:write` | Assign per-user permission overrides |

### RBAC management

| Permission | Description |
|---|---|
| `rbac.roles:read` | View roles |
| `rbac.roles:write` | Create/modify roles |
| `rbac.roles:delete` | Delete roles |
| `rbac.permissions:read` | View all permissions |

### Jobs

| Permission | Description |
|---|---|
| `jobs.templates:read` | View job templates |
| `jobs.templates:write` | Create/modify job templates |
| `jobs.templates:delete` | Delete job templates |
| `jobs.schedules:read` | View job schedules |
| `jobs.schedules:write` | Create/modify job schedules |
| `jobs.schedules:delete` | Delete job schedules |
| `jobs.runs:read` | View job execution history |
| `jobs.runs:execute` | Trigger job execution manually |

### NiFi

| Permission | Description |
|---|---|
| `nifi:read` | View NiFi instances, flows, and monitoring |
| `nifi:write` | Create/modify NiFi instances and flows |
| `nifi:delete` | Delete NiFi instances and flows |
| `nifi:execute` | Execute NiFi operations (deploy, start, stop) |
| `nifi.settings:read` | View NiFi configuration settings |
| `nifi.settings:write` | Modify NiFi configuration settings |

### NiFi Registry

| Permission | Description |
|---|---|
| `registry:read` | View NiFi Registry repositories and flows |
| `registry:write` | Create/modify NiFi Registry entries |
| `registry:delete` | Delete NiFi Registry entries |

### Flows

| Permission | Description |
|---|---|
| `flows:read` | View NiFi flows and process groups |
| `flows:write` | Create/modify NiFi flows |
| `flows:delete` | Delete NiFi flows |
| `flows:deploy` | Deploy NiFi flows to target instances |

---

## System roles

Defined in [backend/tools/seed_rbac.py](../backend/tools/seed_rbac.py). All four are marked as system roles and cannot be deleted from the UI.

### admin

Full access. Every seeded permission is assigned with `granted=True`. Gains access to any new permission only after re-running the seed or assigning it manually.

### operator

Full NiFi, Registry, Flows, Jobs, Git, and Settings (read) access. No user management.

Assigned permissions:

- `dashboard.settings:read`
- `git.repositories:read`, `git.operations:execute`
- `settings.git:read`, `settings.cache:read`, `settings.celery:read`, `settings.credentials:read`, `settings.common:read`
- `jobs.templates:read/write/delete`, `jobs.schedules:read/write/delete`, `jobs.runs:read/execute`
- `nifi:read/write/delete/execute`, `nifi.settings:read`
- `registry:read/write/delete`
- `flows:read/write/delete/deploy`

### network_engineer

Identical to operator (same permission set). Distinct role for organisational purposes — permissions can be customised independently.

### viewer

Read-only access. Cannot modify or execute anything.

Assigned permissions:

- `dashboard.settings:read`
- `git.repositories:read`
- `settings.git:read`, `settings.cache:read`, `settings.celery:read`
- `jobs.templates:read`, `jobs.schedules:read`, `jobs.runs:read`
- `rbac.roles:read`, `rbac.permissions:read`
- `nifi:read`, `nifi.settings:read`
- `registry:read`
- `flows:read`

---

## Router protection status

### Fully RBAC-protected routers

All endpoints use `require_permission`.

#### `/api/settings` — [backend/routers/settings/common.py](../backend/routers/settings/common.py)

| Method | Endpoint pattern | Permission |
|---|---|---|
| GET | `/api/settings` (common config) | `settings.common:read` |
| GET | Git-related settings | `settings.git:read` |
| GET | Cache-related settings | `settings.cache:read` |
| POST/PUT | Common settings | `settings.common:write` |
| POST/PUT | Git settings | `settings.git:write` |
| POST/PUT | Cache settings | `settings.cache:write` |

#### `/api/cache` — [backend/routers/settings/cache.py](../backend/routers/settings/cache.py)

> Note: all endpoints, including GET stats/entries, require `settings.cache:write`.

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/cache/stats`, `/api/cache/entries` | `settings.cache:write` |
| POST | Clear, cleanup, invalidate | `settings.cache:write` |

#### `/api/credentials` — [backend/routers/settings/credentials.py](../backend/routers/settings/credentials.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List, get by ID, get password | `settings.credentials:read` |
| POST | Create | `settings.credentials:write` |
| PUT | Update | `settings.credentials:write` |
| DELETE | Delete | `settings.credentials:delete` |

#### `/api/templates` — [backend/routers/settings/templates.py](../backend/routers/settings/templates.py)

> ⚠️ `settings.templates:read/write/delete` are used here but are **not seeded**. These endpoints always return 403 for all roles. See [Known permission gaps](#known-permission-gaps).

| Method | Endpoint | Permission |
|---|---|---|
| GET | List, get by ID, render, categories | `settings.templates:read` |
| POST | Create, upload, import, render | `settings.templates:write` |
| PUT | Update | `settings.templates:write` |
| DELETE | Delete | `settings.templates:delete` |

#### `/api/git-repositories` — [backend/routers/settings/git/repositories.py](../backend/routers/settings/git/repositories.py) and [debug.py](../backend/routers/settings/git/debug.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List, get by ID, health | `git.repositories:read` |
| POST | Create, test connection, debug ops | `git.repositories:write` |
| PUT | Update | `git.repositories:write` |
| DELETE | Delete | `git.repositories:delete` |

#### `/api/git/{repo_id}` — files, operations, version control

Three routers share this prefix. Sources: [files.py](../backend/routers/settings/git/files.py), [operations.py](../backend/routers/settings/git/operations.py), [version_control.py](../backend/routers/settings/git/version_control.py).

| Method | Endpoint | Permission |
|---|---|---|
| GET | File tree, file content, diffs, branches, tags | `git.repositories:read` |
| GET | Version control status | `git.repositories:read` |
| POST/PUT | Sync, commit, push, pull, tag | `git.operations:execute` |
| POST | Stash, checkout, reset | `git.operations:execute` |

#### `/api/job-runs` — [backend/routers/jobs/runs.py](../backend/routers/jobs/runs.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List runs, get by ID, logs, status | `jobs.runs:read` |
| POST | Trigger run, cancel run | `jobs.runs:execute` |
| DELETE | Delete run | `jobs.runs:execute` |

#### `/api/celery` — [backend/routers/jobs/celery_api.py](../backend/routers/jobs/celery_api.py)

> ⚠️ Several permissions used here are **not seeded**. See [Known permission gaps](#known-permission-gaps).

| Method | Endpoint | Permission |
|---|---|---|
| GET | Worker status, task inspect | `settings.celery:read` |
| POST | Revoke task, purge queue | `settings.celery:write` |
| POST | Cache device data | `settings.cache:write` |
| POST | Onboard device | `devices.onboard:execute` ⚠️ not seeded |
| GET | Device export status | `nautobot.export:read` ⚠️ not seeded |
| POST | Trigger device export | `nautobot.export:execute` ⚠️ not seeded |
| POST | Sync locations/devices | `nautobot.locations:write` / `nautobot.devices:write` ⚠️ not seeded |
| GET | Job task results | `jobs:read` ⚠️ not seeded |

#### `/api/nifi/instances` — [backend/routers/nifi/instances.py](../backend/routers/nifi/instances.py), [operations.py](../backend/routers/nifi/operations.py), [deploy.py](../backend/routers/nifi/deploy.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List, get by ID, ping, process groups, registries, parameters, flow versions | `nifi:read` |
| POST | Create, import flow, create parameter context | `nifi:write` |
| PUT | Update instance, update parameter context, processor config | `nifi:write` |
| DELETE | Delete instance, delete parameter context | `nifi:delete` |
| POST | `/{instance_id}/deploy` | `nifi:execute` |

#### `/api/nifi/flows` — [backend/routers/nifi/nifi_flows.py](../backend/routers/nifi/nifi_flows.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List, columns | `nifi:read` |
| POST | Create, copy | `nifi:write` |
| PUT | Update | `nifi:write` |
| DELETE | Delete | `nifi:delete` |

#### `/api/nifi/flow-views` — [backend/routers/nifi/flow_views.py](../backend/routers/nifi/flow_views.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List, get by ID | `nifi:read` |
| POST | Create, set default | `nifi:write` |
| PUT | Update | `nifi:write` |
| DELETE | Delete | `nifi:delete` |

#### `/api/nifi/hierarchy` — [backend/routers/nifi/hierarchy.py](../backend/routers/nifi/hierarchy.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | Get hierarchy, flow count, attribute values, deploy config | `nifi:read` |
| POST | Set hierarchy, add value, delete value, set deploy config | `nifi.settings:write` |

#### `/api/nifi/install` — [backend/routers/nifi/install.py](../backend/routers/nifi/install.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | Check path | `nifi:read` |

#### `/api/nifi/certificates` — [backend/routers/nifi/certificates.py](../backend/routers/nifi/certificates.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List certificates | `nifi:read` |

#### `/api/nifi/registry-flows` — [backend/routers/nifi/registry_flows.py](../backend/routers/nifi/registry_flows.py)

| Method | Endpoint | Permission |
|---|---|---|
| GET | List, get by ID, filter by instance | `nifi:read` |
| POST | Create / upsert | `nifi:write` |
| DELETE | Delete | `nifi:delete` |

---

### Partially protected routers

These routers mix `require_permission` with the legacy `verify_token` dependency.

#### `/api/job-schedules` — [backend/routers/jobs/schedules.py](../backend/routers/jobs/schedules.py)

Most endpoints only require `verify_token` (any authenticated user). One endpoint requires `jobs:write`, which is not seeded.

| Method | Endpoint | Auth |
|---|---|---|
| POST | Create schedule | `verify_token` ⚠️ under-protected |
| GET | List schedules | `verify_token` ⚠️ under-protected |
| GET | Get by ID | `verify_token` ⚠️ under-protected |
| PUT | Update schedule | `verify_token` ⚠️ under-protected |
| DELETE | Delete schedule | `verify_token` ⚠️ under-protected |
| POST | Execute now | `verify_token` ⚠️ under-protected |
| GET | Scheduler debug status | `verify_token` ⚠️ under-protected |
| POST | (one endpoint) | `jobs:write` ⚠️ not seeded |

#### `/api/rbac` — [backend/routers/settings/rbac.py](../backend/routers/settings/rbac.py)

Read operations use `verify_token` (any logged-in user can read RBAC data). Write operations use `require_role("admin")`.

| Method | Endpoint | Auth |
|---|---|---|
| GET | List permissions, roles, user roles, my permissions | `verify_token` |
| GET | Check permission | `verify_token` |
| POST | Create permission, role | `require_role("admin")` |
| DELETE | Delete permission, role | `require_role("admin")` |
| POST/DELETE | Assign/remove role from user | `verify_token` |
| GET | List users (RBAC view) | `verify_token` |

---

### Legacy auth only (verify_token)

All endpoints in these routers allow any authenticated user.

#### `/api/job-templates` — [backend/routers/jobs/templates.py](../backend/routers/jobs/templates.py)

All endpoints use `verify_token`. Should migrate to `jobs.templates:read/write/delete`.

---

### Public endpoints (no auth)

#### `/auth` — [backend/routers/auth/auth.py](../backend/routers/auth/auth.py)

Login, token refresh, API key login. No authentication required.

#### `/auth/oidc` — [backend/routers/auth/oidc.py](../backend/routers/auth/oidc.py)

OIDC provider discovery, callback handling. No authentication required.

#### `/profile` — [backend/routers/auth/profile.py](../backend/routers/auth/profile.py)

Own user profile only. Uses `get_current_username` (valid JWT required). Not RBAC-gated because users can only access their own profile.

---

## Known permission gaps

These permissions are referenced in router code but not defined in [seed_rbac.py](../backend/tools/seed_rbac.py). Any endpoint requiring them always returns 403, including for admins.

| Permission | Used in | Impact |
|---|---|---|
| `settings.templates:read` | `/api/templates` GET endpoints | All template views broken for everyone |
| `settings.templates:write` | `/api/templates` POST/PUT endpoints | All template mutations broken for everyone |
| `settings.templates:delete` | `/api/templates` DELETE endpoints | All template deletes broken for everyone |
| `devices.onboard:execute` | `/api/celery` onboard endpoint | Celery-triggered onboarding broken |
| `nautobot.export:read` | `/api/celery` export status endpoint | Nautobot export status broken |
| `nautobot.export:execute` | `/api/celery` trigger export endpoint | Nautobot export trigger broken |
| `nautobot.devices:read` | `/api/celery` device endpoints | Celery device read broken |
| `nautobot.devices:write` | `/api/celery` device sync endpoints | Celery device sync broken |
| `nautobot.locations:write` | `/api/celery` location sync endpoint | Celery location sync broken |
| `jobs:read` | `/api/celery` task result endpoint | Task result lookup broken |
| `jobs:write` | `/api/job-schedules` one endpoint | That schedule endpoint is broken |

To fix: add the missing permissions to `seed_permissions()` in [seed_rbac.py](../backend/tools/seed_rbac.py), assign them to the appropriate roles in `assign_permissions_to_roles()`, then re-run the seed script.

---

## Implementation reference

### Adding permission checks to a new endpoint

```python
from core.auth import require_permission

@router.get("/items")
async def list_items(
    user: dict = Depends(require_permission("myresource", "read"))
):
    return service.list_items()
```

### Adding a new permission to the system

1. Add it to `seed_permissions()` in [backend/tools/seed_rbac.py](../backend/tools/seed_rbac.py).
2. Assign it to the relevant roles in `assign_permissions_to_roles()` in the same file.
3. Re-run the seed: `python tools/seed_rbac.py` (existing permissions are skipped safely).
4. Update this document.

### Re-seeding from scratch

```bash
cd backend
python tools/seed_rbac.py --remove-existing-permissions
```

This removes **all** role and permission assignments, then re-seeds. Users must be re-assigned to roles afterwards.

### JWT token structure

```json
{
  "sub": "username",
  "user_id": 123,
  "permissions": 15,
  "exp": 1234567890
}
```

The `permissions` field is a legacy bitwise integer retained for backward compatibility. The RBAC system uses `user_id` to look up permissions from the database on every request — the bitwise field is not used for access control decisions.

---

## Change log

| Date | Change |
|---|---|
| 2026-02-22 | Rewrote from scratch to reflect actual codebase. Fixed user_id `None`-check bug in `require_permission`. Changed deploy endpoint from `nifi:write` to `nifi:execute`. Documented all known permission gaps. |
