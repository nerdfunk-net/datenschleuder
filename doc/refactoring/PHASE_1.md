# Phase 1: Eliminate Root-Level Manager Files

## Goal

Migrate all 11 root-level `*_manager.py` files from `/backend/` into proper service layers following the documented architecture: **Model → Repository → Service → Router**. Delete dead code.

## Current State

These managers sit at `/backend/*.py` and are called directly by routers, bypassing the service layer. They wrap repositories but contain business logic that should live in dedicated services under `/backend/services/`.

| Manager File | Lines | Public Methods | Repository Used | Has Circular Deps |
|---|---|---|---|---|
| `rbac_manager.py` | 596 | 32 | `RBACRepository` | Yes → `user_db_manager` |
| `credentials_manager.py` | 599 | 17 | `CredentialsRepository` | No |
| `settings_manager.py` | 656 | 18+ | 4 repos + YAML | No |
| `template_manager.py` | 520 | 12 | `TemplateRepository`, `TemplateVersionRepository` | No |
| `user_db_manager.py` | 408 | 18 | `UserRepository` | Yes → `rbac_manager` |
| `jobs_manager.py` | 416 | 14 | `JobScheduleRepository` | Yes → `job_template_manager` |
| `job_run_manager.py` | 400 | 17 | `JobRunRepository` | Yes → `jobs_manager`, `job_template_manager` |
| `job_template_manager.py` | 245 | 10 | `JobTemplateRepository` | Yes → `job_run_manager`, `jobs_manager` |
| `git_repositories_manager.py` | 214 | 9 | `GitRepositoryRepository` | No |
| `profile_manager.py` | 152 | 5 | `ProfileRepository` | No |

**Dead code:** `/backend/models/job_models.py` (126 lines) — imported nowhere.

---

## Refactoring Steps

### Step 0: Delete Dead Code

**File:** `/backend/models/job_models.py` (126 lines)

- Contains: `JobStatus`, `JobType`, `JobProgress`, `Job`, `NetworkScanRequest`
- Imported by: **nothing** — confirmed zero references across entire codebase
- Real Pydantic models live in `/backend/models/job_templates.py` and `/backend/models/jobs.py`
- **Action:** Delete file, verify no imports break

---

### Step 1: RBAC + User Management (Break Circular Dependency)

**Problem:** `rbac_manager.py` ↔ `user_db_manager.py` have circular imports. The `rbac_manager` calls `user_db_manager` for user creation/deletion, and `user_db_manager` calls `rbac_manager` for permission/role operations.

**Target services:**

#### 1a. Create `/backend/services/auth/rbac_service.py`

Absorbs all 32 methods from `rbac_manager.py`:

**Permission CRUD:**
- `create_permission()`, `get_permission()`, `get_permission_by_id()`, `list_permissions()`, `delete_permission()`

**Role CRUD:**
- `create_role()`, `get_role()`, `get_role_by_name()`, `list_roles()`, `update_role()`, `delete_role()`

**Role-Permission Assignments:**
- `assign_permission_to_role()`, `remove_permission_from_role()`, `get_role_permissions()`

**User-Role Assignments:**
- `assign_role_to_user()`, `remove_role_from_user()`, `get_user_roles()`, `get_users_with_role()`

**User-Permission Overrides:**
- `assign_permission_to_user()`, `remove_permission_from_user()`, `get_user_permission_overrides()`

**Permission Checks:**
- `has_permission()`, `get_user_permissions()`, `check_any_permission()`, `check_all_permissions()`

**User-RBAC Compound Operations (previously in user_db_manager):**
- `create_user_with_roles()`, `get_user_with_rbac()`, `list_users_with_rbac()`
- `update_user_profile()`, `delete_user_with_rbac()`, `bulk_delete_users_with_rbac()`
- `toggle_user_activation()`, `toggle_user_debug()`

**Dependencies:**
- `RBACRepository` (existing)
- `UserRepository` (existing)
- DB session via dependency injection

**Key design:** The service receives both repositories via constructor injection, eliminating the circular import.

```python
class RBACService:
    def __init__(self, db: Session):
        self.rbac_repo = RBACRepository(db)
        self.user_repo = UserRepository(db)
```

#### 1b. Create `/backend/services/auth/user_service.py`

Absorbs core user methods from `user_db_manager.py`:

**User CRUD:**
- `create_user()`, `get_all_users()`, `get_user_by_id()`, `get_user_by_username()`
- `authenticate_user()`, `update_user()`, `delete_user()`, `hard_delete_user()`
- `bulk_delete_users()`, `bulk_hard_delete_users()`

**Legacy Permission Bridge (temporary, until legacy permission bits are fully removed):**
- `bulk_update_permissions()`, `has_permission()`, `get_permission_name()`, `get_role_name()`, `get_permissions_for_role()`

**Admin Initialization:**
- `ensure_admin_user_permissions()`, `ensure_admin_has_rbac_role()`
- `_ensure_admin_role_assigned()`, `_create_default_admin_without_rbac()`

**Dependencies:**
- `UserRepository` (existing)
- Password hashing via `core.auth`
- DB session via dependency injection

#### 1c. Update Consumers

| Consumer | Current Import | New Import |
|---|---|---|
| `/routers/settings/rbac.py` | `rbac_manager` | `services.auth.rbac_service.RBACService` |
| `/routers/jobs/templates.py` | `rbac_manager.has_permission()` | `services.auth.rbac_service.RBACService` |
| `/routers/auth/profile.py` | `user_db_manager` | `services.auth.user_service.UserService` |
| `/tools/seed_rbac.py` | `rbac_manager`, `user_db_manager` | Both new services |
| `/main.py` | `user_db_manager` (admin init) | `services.auth.user_service.UserService` |
| `profile_manager.py` | `user_db_manager` | `services.auth.user_service.UserService` (or remove profile_manager first, see Step 5) |

#### 1d. Delete old files

- Delete `/backend/rbac_manager.py`
- Delete `/backend/user_db_manager.py`

---

### Step 2: Settings Manager (Split by Concern)

**Problem:** `settings_manager.py` (656 lines) mixes two distinct concerns: database settings (Git, Cache, Celery) and OIDC file configuration (YAML-based).

**Target services:**

#### 2a. Create `/backend/services/settings/settings_service.py`

Absorbs database-related settings methods:

**Git Settings:** `get_git_settings()`, `update_git_settings()`
**Cache Settings:** `get_cache_settings()`, `update_cache_settings()`
**Celery Settings:** `get_celery_settings()`, `update_celery_settings()`
**Meta Operations:** `get_all_settings()`, `update_all_settings()`, `ensure_builtin_queues()`, `reset_to_defaults()`, `health_check()`
**Git Repository Selection:** `get_selected_git_repository()`, `set_selected_git_repository()`

**Dependencies:**
- `GitSettingRepository`, `CacheSettingRepository`, `CelerySettingRepository`, `SettingsMetadataRepository`
- DB session

#### 2b. Create `/backend/services/auth/oidc_config_service.py`

Absorbs OIDC file configuration methods:

- `load_oidc_providers()` — reads YAML file
- `get_oidc_providers()`, `get_enabled_oidc_providers()`, `get_nifi_oidc_providers()`
- `get_oidc_provider()`, `get_oidc_global_settings()`, `is_oidc_enabled()`

**Dependencies:**
- YAML file I/O (`oidc_providers.yaml`)
- Environment variables
- No database dependency

#### 2c. Update Consumers

| Consumer | Current Import | New Import |
|---|---|---|
| `/routers/settings/common.py` | `settings_manager` | `services.settings.settings_service.SettingsService` |
| `/routers/settings/git/...` | `settings_manager` | `services.settings.settings_service.SettingsService` |
| `/routers/auth/oidc.py` | `settings_manager` | `services.auth.oidc_config_service.OIDCConfigService` |
| `/routers/jobs/celery_api.py` | `settings_manager` | `services.settings.settings_service.SettingsService` |
| `/services/settings/git/...` | `settings_manager` | `services.settings.settings_service.SettingsService` |
| `/services/auth/oidc/service.py` | `settings_manager` | `services.auth.oidc_config_service.OIDCConfigService` |
| `start_celery.py` | `settings_manager` | `services.settings.settings_service.SettingsService` |
| `/main.py` | `settings_manager` | Both new services |

**Important:** `settings_manager` currently uses a global singleton (`settings_manager = SettingsManager()`). The new services should use FastAPI's dependency injection with `Depends(get_db)` instead.

#### 2d. Delete old file

- Delete `/backend/settings_manager.py`

---

### Step 3: Credentials Manager (Split DB vs Filesystem)

**Problem:** `credentials_manager.py` (599 lines) mixes database credential CRUD with filesystem SSH key export operations.

**Target services:**

#### 3a. Create `/backend/services/settings/credentials_service.py`

Absorbs database credential methods:

- `list_credentials()`, `get_credential_by_id()`, `create_credential()`, `update_credential()`, `delete_credential()`, `delete_credentials_by_owner()`
- `get_decrypted_password()`, `get_decrypted_ssh_key()`, `get_decrypted_ssh_passphrase()`
- `has_ssh_key()`, `get_ssh_key_credentials()`, `get_ssh_key_path()`

**Dependencies:**
- `CredentialsRepository` (existing)
- Cryptography (Fernet encryption)

#### 3b. Create `/backend/services/settings/ssh_key_service.py`

Absorbs filesystem operations:

- `export_single_ssh_key()`, `export_ssh_keys_to_filesystem()`
- `_get_ssh_keys_directory()`, `_get_ssh_key_filename_prefix()`, `_delete_ssh_key_file()`

**Dependencies:**
- `CredentialsService` (from 3a, for decryption)
- Filesystem operations (`/data/ssh_keys/`)

#### 3c. Update Consumers

| Consumer | Current Import | New Import |
|---|---|---|
| `/routers/settings/credentials.py` | `credentials_manager` | `services.settings.credentials_service.CredentialsService` |
| `/routers/auth/profile.py` | `credentials_manager` | `services.settings.credentials_service.CredentialsService` |
| `rbac_manager.py` (→ rbac_service after Step 1) | `credentials_manager.delete_credentials_by_owner()` | `services.settings.credentials_service.CredentialsService` |
| `profile_manager.py` | `credentials_manager` | `services.settings.credentials_service.CredentialsService` |
| `/main.py` | `credentials_manager` (SSH key export on startup) | `services.settings.ssh_key_service.SSHKeyService` |

#### 3d. Delete old file

- Delete `/backend/credentials_manager.py`

---

### Step 4: Job Managers (Break Circular Dependencies)

**Problem:** Three job managers have circular dependencies:
- `jobs_manager.py` → `job_template_manager` (for template name resolution in `_model_to_dict()`)
- `job_run_manager.py` → `jobs_manager`, `job_template_manager` (for name lookups)
- `job_template_manager.py` → `job_run_manager`, `jobs_manager` (cross-references)

**Target services:**

#### 4a. Create `/backend/services/jobs/job_schedule_service.py`

Absorbs from `jobs_manager.py` (note: this manager only handles schedules despite the generic name):

- `create_job_schedule()`, `get_job_schedule()`, `list_job_schedules()`, `update_job_schedule()`, `delete_job_schedule()`
- `update_job_run_times()`, `get_user_job_schedules()`, `get_global_job_schedules()`
- `initialize_schedule_next_runs()`, `calculate_next_run()`, `calculate_and_update_next_run()`
- `_model_to_dict()` — **key change:** remove direct import of `job_template_manager`; instead accept template data via parameter or use lazy resolution

**Dependencies:**
- `JobScheduleRepository` (existing)
- croniter (for cron expression parsing)

#### 4b. Create `/backend/services/jobs/job_run_service.py`

Absorbs from `job_run_manager.py`:

**CRUD:** `create_job_run()`, `get_job_run()`, `get_job_run_by_celery_id()`, `get_job_runs_by_celery_ids()`, `list_job_runs()`, `delete_job_run()`
**Queries:** `get_recent_runs()`, `get_runs_since()`, `get_schedule_runs()`, `get_distinct_templates()`
**State Transitions:** `mark_started()`, `mark_completed()`, `mark_failed()`, `mark_cancelled()`
**Stats:** `get_running_count()`, `get_pending_count()`, `get_queue_stats()`, `get_dashboard_stats()`
**Cleanup:** `cleanup_old_runs()`, `cleanup_old_runs_hours()`, `clear_all_runs()`, `clear_filtered_runs()`

**Dependencies:**
- `JobRunRepository` (existing)
- **No cross-manager imports** — `_model_to_dict()` should resolve template/schedule names via passed data or a lookup service

#### 4c. Create `/backend/services/jobs/job_template_service.py`

Absorbs from `job_template_manager.py`:

- `create_job_template()`, `get_job_template()`, `get_job_template_by_name()`, `list_job_templates()`, `get_user_job_templates()`, `update_job_template()`, `delete_job_template()`
- `get_job_types()` — returns available job types

**Dependencies:**
- `JobTemplateRepository` (existing)

#### Breaking the Circular Dependencies

The key issue is `_model_to_dict()` in each manager doing cross-lookups. Solution:

1. Each service's `_model_to_dict()` only serializes its own model fields
2. If template/schedule names are needed for display, the **router** or a **facade service** does the join:

```python
# Router example - compose data from multiple services
run = job_run_service.get_job_run(run_id)
if run.get("job_template_id"):
    template = job_template_service.get_job_template(run["job_template_id"])
    run["template_name"] = template.get("name") if template else None
```

#### 4d. Update Consumers

| Consumer | Current Import | New Import |
|---|---|---|
| `/routers/jobs/schedules.py` | `jobs_manager` | `services.jobs.job_schedule_service` |
| `/routers/jobs/runs.py` | `job_run_manager` | `services.jobs.job_run_service` |
| `/routers/jobs/templates.py` | `job_template_manager` | `services.jobs.job_template_service` |
| `/tasks/scheduling/schedule_checker.py` | `jobs_manager` | `services.jobs.job_schedule_service` |
| `/tasks/scheduling/job_dispatcher.py` | `job_run_manager` | `services.jobs.job_run_service` |
| `/tasks/periodic_tasks.py` | `job_run_manager` | `services.jobs.job_run_service` |
| `/main.py` | `jobs_manager` (init) | `services.jobs.job_schedule_service` |

#### 4e. Delete old files

- Delete `/backend/jobs_manager.py`
- Delete `/backend/job_run_manager.py`
- Delete `/backend/job_template_manager.py`

---

### Step 5: Template Manager

**Problem:** `template_manager.py` (520 lines) wraps `TemplateRepository` and `TemplateVersionRepository` but is a module-level singleton, not a service.

#### 5a. Create `/backend/services/settings/template_service.py`

Absorbs all methods:

- `create_template()`, `get_template()`, `get_template_by_name()`, `list_templates()`, `update_template()`, `delete_template()`
- `get_template_content()`, `render_template()`, `get_template_versions()`, `search_templates()`, `get_categories()`, `health_check()`

**Dependencies:**
- `TemplateRepository`, `TemplateVersionRepository` (existing)
- Jinja2 (for rendering)
- hashlib (for content hashing)

**Note:** This manager is well-designed internally. The refactoring is mainly structural (module singleton → injected service).

#### 5b. Update Consumers

| Consumer | Current Import | New Import |
|---|---|---|
| `/routers/settings/templates.py` | `template_manager` | `services.settings.template_service.TemplateService` |
| Git sync services | `template_manager` | `services.settings.template_service.TemplateService` |

#### 5c. Delete old file

- Delete `/backend/template_manager.py`

---

### Step 6: Git Repositories Manager

**Problem:** `git_repositories_manager.py` (214 lines) duplicates functionality that exists in `/backend/services/settings/git/`.

#### 6a. Merge into existing `/backend/services/settings/git/service.py`

Or create a new `/backend/services/settings/git/repository_service.py` if the existing service is too large.

Absorbs:
- `create_repository()`, `get_repository()`, `get_repositories()`, `update_repository()`, `delete_repository()`
- `update_sync_status()`, `get_repositories_by_category()`, `health_check()`

**Dependencies:**
- `GitRepositoryRepository` (existing)

#### 6b. Update Consumers

All routers/services that import `git_repositories_manager` → use the new/merged git service.

#### 6c. Delete old file

- Delete `/backend/git_repositories_manager.py`

---

### Step 7: Profile Manager

**Problem:** `profile_manager.py` (152 lines) is small but doesn't follow the service pattern.

#### 7a. Create `/backend/services/auth/profile_service.py`

Absorbs:
- `get_user_profile()`, `update_user_profile()`, `update_user_password()`, `delete_user_profile()`

**Dependencies:**
- `ProfileRepository` (existing)
- `CredentialsService` (from Step 3, for password operations)

#### 7b. Update Consumers

| Consumer | Current Import | New Import |
|---|---|---|
| `/routers/auth/profile.py` | `profile_manager` | `services.auth.profile_service.ProfileService` |
| `rbac_manager.py` (→ rbac_service after Step 1) | `profile_manager.delete_user_profile()` | `services.auth.profile_service.ProfileService` |

#### 7c. Delete old file

- Delete `/backend/profile_manager.py`

---

## Execution Order

The steps above have dependencies between them. Recommended order:

```
Step 0: Delete dead code (job_models.py)          → No dependencies
Step 1: RBAC + User managers                       → Must be first (most coupled)
Step 5: Template manager                           → Independent
Step 6: Git repositories manager                   → Independent
Step 7: Profile manager                            → Depends on Step 1 (rbac_manager ref)
Step 3: Credentials manager                        → Depends on Step 1 (rbac_manager ref)
Step 2: Settings manager                           → Independent, but large
Step 4: Job managers                               → Independent
```

Steps 0, 5, 6 can be done in parallel. Steps 1 must come before 3 and 7.

---

## Verification Checklist

After each step:

1. **Import check:** `grep -r "import {old_manager}" backend/` returns zero results
2. **No circular imports:** `python -c "from services.auth.rbac_service import RBACService"` succeeds
3. **Router tests:** All API endpoints return correct responses
4. **Startup test:** `python start.py` boots without errors
5. **Singleton elimination:** No global manager singletons remain; all services use DI

After all steps:

- [ ] Zero `*_manager.py` files remain in `/backend/` root (except managers that are actually part of some other pattern)
- [ ] All services live under `/backend/services/`
- [ ] No circular imports between services
- [ ] All routers import from `services/`, never from root-level managers
- [ ] `/backend/models/job_models.py` deleted
- [ ] Application starts and all endpoints work

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Circular import resurfaces in new services | MEDIUM | HIGH | Use constructor injection, avoid cross-service imports |
| Global singleton behavior changes (settings_manager) | MEDIUM | MEDIUM | Cache in service instance or use FastAPI lifespan |
| Missing consumer during migration | LOW | HIGH | grep all imports before deleting old file |
| Celery tasks import manager directly | MEDIUM | MEDIUM | Check `/tasks/` directory for all manager imports |
| main.py startup initialization breaks | HIGH | HIGH | Test startup after each step |

---

## Files Created (Summary)

```
NEW:
  services/auth/rbac_service.py          (~350 lines)
  services/auth/user_service.py          (~250 lines)
  services/auth/profile_service.py       (~100 lines)
  services/auth/oidc_config_service.py   (~120 lines)
  services/settings/settings_service.py  (~300 lines)
  services/settings/credentials_service.py (~350 lines)
  services/settings/ssh_key_service.py   (~100 lines)
  services/settings/template_service.py  (~350 lines)
  services/jobs/job_schedule_service.py  (~250 lines)
  services/jobs/job_run_service.py       (~300 lines)
  services/jobs/job_template_service.py  (~150 lines)

DELETED:
  rbac_manager.py                        (596 lines)
  user_db_manager.py                     (408 lines)
  settings_manager.py                    (656 lines)
  credentials_manager.py                 (599 lines)
  template_manager.py                    (520 lines)
  jobs_manager.py                        (416 lines)
  job_run_manager.py                     (400 lines)
  job_template_manager.py                (245 lines)
  git_repositories_manager.py            (214 lines)
  profile_manager.py                     (152 lines)
  models/job_models.py                   (126 lines)

NET: ~4,332 lines deleted, ~2,620 lines created = ~1,700 lines reduction
     (plus better structure, testability, no circular deps)
```
