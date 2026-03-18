# Phase 2: Extract Business Logic from Fat Routers

## Goal

Make all routers thin HTTP adapters that only handle request parsing, service delegation, and response formatting. Extract all embedded business logic into dedicated service layers.

## Prerequisite

**Phase 1 must be completed first.** Phase 1 creates the service layer that Phase 2 routers will delegate to. Several routers currently import root-level managers that will be replaced by services in Phase 1.

## Current State

8 router files contain significant business logic (~3,500+ lines of embedded logic across ~6,200 total lines):

| Router File | Lines | Endpoints | Business Logic % | Priority |
|---|---|---|---|---|
| `routers/settings/git/files.py` | 971 | 9 | 65% (~630 lines) | CRITICAL |
| `routers/nifi/operations.py` | 932 | 28 | 20% (~185 lines) | SKIP (already well-structured) |
| `routers/settings/templates.py` | 923 | 16 | 60% (~550 lines) | CRITICAL |
| `routers/jobs/celery_api.py` | 814 | 23 | 45% (~365 lines) | HIGH |
| `routers/settings/git/debug.py` | 750 | 5 | 80% (~600 lines) | CRITICAL |
| `routers/settings/rbac.py` | 695 | 41 | 40% (~280 lines) | LOW-MEDIUM |
| `routers/jobs/runs.py` | 493 | 11 | 50% (~245 lines) | HIGH |
| `routers/jobs/schedules.py` | 468 | 8 | 55% (~257 lines) | HIGH |

**Reference implementation:** `routers/nifi/operations.py` demonstrates the correct pattern — thin endpoints delegating to 8 different NiFi service modules. **Do not refactor this file.** Use it as the model for all other router refactoring.

---

## Reference Pattern (from nifi/operations.py)

Every endpoint should follow this structure:

```python
@router.get("/endpoint")
async def my_endpoint(
    param: str,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token),
):
    try:
        service = MyService(db)
        result = await service.do_something(param)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")
```

**Rules:**
- Router reads HTTP parameters (path, query, body, headers)
- Router calls one or more service methods
- Router maps service exceptions → HTTP exceptions
- Router formats response
- **No loops, no file I/O, no Redis, no Git operations, no business rules in the router**

---

## Step 1: Extract `routers/settings/git/debug.py` (750 lines, 80% logic)

**Why first:** Highest business logic concentration (80%), single service target, isolated from other routers.

### Current State

5 endpoints, all containing complete workflows:

| Endpoint | Function | Lines | Business Logic |
|---|---|---|---|
| `POST /{repo_id}/debug/read` | `debug_read_test` | 26-102 | File existence checks, permission testing, error mapping |
| `POST /{repo_id}/debug/write` | `debug_write_test` | 105-213 | File creation, write verification, git status checking |
| `POST /{repo_id}/debug/delete` | `debug_delete_test` | 216-310 | File deletion, verification, git status checking |
| `POST /{repo_id}/debug/push` | `debug_push_test` | 313-572 | **260 lines** — auth validation, file ops, git stage/commit/push, error mapping |
| `GET /{repo_id}/debug/diagnostics` | `debug_diagnostics` | 575-749 | **175 lines** — multi-section diagnostic gathering |

### Target Service

**Create: `/backend/services/settings/git/debug_service.py`** (~350-400 lines)

```python
class GitDebugService:
    def __init__(self, db: Session):
        self.db = db
        self.git_service = get_git_service(db)
        self.git_auth_service = get_git_auth_service(db)

    # Read/Write/Delete tests
    def test_read(self, repo_id: int) -> DebugTestResult
    def test_write(self, repo_id: int) -> DebugTestResult
    def test_delete(self, repo_id: int) -> DebugTestResult

    # Push workflow (currently 260 lines in router)
    def test_push(self, repo_id: int) -> DebugPushTestResult
    def _validate_push_authentication(self, repository: dict) -> tuple[bool, str]
    def _prepare_test_file(self, repo_path: Path) -> str
    def _execute_push(self, repo, repository: dict, commit_sha: str) -> DebugPushResult
    def _map_push_error(self, error_message: str) -> str

    # Diagnostics (currently 175 lines in router)
    def get_diagnostics(self, repo_id: int) -> GitDiagnostics
    def _get_repository_info(self, repository: dict) -> dict
    def _test_repository_access(self, repo_path: Path) -> dict
    def _check_file_system_permissions(self, repo_path: Path) -> dict
    def _check_git_status(self, repo) -> dict
    def _check_ssl_configuration(self, repository: dict) -> dict
    def _analyze_credentials(self, repository: dict) -> dict
    def _assess_push_capability(self, repository: dict, credentials_info: dict, repo) -> dict

    # Shared helpers
    def _format_error_details(self, error: Exception, file_path: Path, error_type: str) -> dict
```

### After Refactoring

Router becomes ~50 lines — 5 thin endpoints:

```python
@router.post("/{repo_id}/debug/push")
async def debug_push_test(repo_id: int, db: Session = Depends(get_db), user: dict = Depends(verify_token)):
    service = GitDebugService(db)
    return service.test_push(repo_id)
```

**Shared patterns to extract:**
- Git status checking (repeated in read/write/delete tests at lines 137-142, 256-264)
- Error detail formatting (repeated in all 5 endpoints)

---

## Step 2: Extract `routers/settings/git/files.py` (971 lines, 65% logic)

### Current State

9 endpoints with 4 major business logic blocks:

| Endpoint | Function | Lines | Issue |
|---|---|---|---|
| `GET /files/search` | `search_repository_files` | 25-148 | **117 lines** of search with os.walk, relevance scoring, pagination |
| `GET /files/{commit_hash}/commit` | `get_files` | 150-199 | LOW — acceptable |
| `GET /files/{file_path}/history` | `get_file_history` | 202-256 | LOW — acceptable |
| `GET /files/{file_path}/complete-history` | `get_file_complete_history` | 259-400 | **142 lines** — commit history reconstruction, gap detection |
| `GET /file-content` | `get_file_content` | 403-492 | MEDIUM |
| `PUT /file-content` | `write_file_content` | 503-591 | MEDIUM — uses existing service partially |
| `GET /file-content-parsed` | `get_file_content_parsed` | 594-683 | MEDIUM |
| `GET /tree` | `get_directory_tree` | 686-814 | **129 lines** — recursive tree traversal |
| `GET /directory` | `get_directory_files` | 817-970 | **154 lines** — per-file metadata collection |

### Target Services

**Create 3 new services:**

#### `/backend/services/settings/git/file_search_service.py` (~80 lines)

Absorbs file search logic from lines 25-148:
```python
class GitFileSearchService:
    def search(self, repo_id: int, search_term: str, page: int, page_size: int) -> list[FileMatch]
    def _calculate_relevance(self, filename: str, content_excerpt: str, search_term: str) -> int
    def _enumerate_files(self, repo_path: Path) -> list[str]
```

#### `/backend/services/settings/git/file_history_service.py` (~120 lines)

Absorbs complete history logic from lines 259-400:
```python
class GitFileHistoryService:
    def get_complete_history(self, repo_id: int, file_path: str) -> FileHistory
    def _detect_gaps(self, commits: list) -> list[CommitGap]
    def _identify_change_type(self, commit, file_path: str) -> ChangeType
    def _build_cache_key(self, repo_id: int, file_path: str) -> str
```

#### `/backend/services/settings/git/directory_service.py` (~150 lines)

Absorbs tree building (lines 686-814) and directory listing (lines 817-970):
```python
class GitDirectoryService:
    def get_directory_tree(self, repo_id: int, path: str = "/") -> DirectoryTree
    def list_directory(self, repo_id: int, path: str) -> list[FileWithMetadata]
    def _build_tree(self, repo_path: Path, tree_path: str) -> DirectoryNode
    def _get_file_metadata(self, path: Path, commit_info: dict) -> FileMetadata
    def _get_file_commit_info(self, repo_path: Path, file_path: str) -> CommitInfo
```

### After Refactoring

Router: ~320 lines (from 971). Endpoints become thin wrappers.

**Dependencies currently in router:**
- `git_repo_manager` → replaced by git service (from Phase 1)
- `get_git_service` → existing service
- `get_cache_service` → existing service
- `os`, `subprocess`, `GitPython` → moved into services

---

## Step 3: Extract `routers/settings/templates.py` (923 lines, 60% logic)

### Current State

16 endpoints with 4 major business logic blocks:

| Endpoint | Function | Lines | Issue |
|---|---|---|---|
| `GET /templates` | `list_templates` | 32-98 | LOW |
| `GET /templates/categories` | `get_template_categories` | 101-116 | LOW |
| `GET /templates/scan-import` | `scan_import_directory` | 119-199 | **74 lines** — YAML directory scanning |
| `POST /templates` | `create_template` | 202-235 | LOW |
| `GET /templates/{id}` | `get_template` | 238-263 | LOW |
| `PUT /templates/{id}` | `update_template` | 294-351 | **17 lines** magic number permission check |
| `DELETE /templates/{id}` | `delete_template` | 354-381 | LOW |
| `POST /templates/upload` | `upload_template_file` | 432-491 | MEDIUM — file type inference |
| `POST /templates/import` | `import_templates` | 560-763 | **204 lines** — multi-source import (YAML, file, git) |
| `POST /templates/advanced-render` | `advanced_render_template` | 766-907 | **142 lines** — template rendering + pre-run commands |

### Target Services

**Create 4 new services:**

#### `/backend/services/settings/templates/import_service.py` (~200 lines)

Absorbs directory scanning (lines 119-199) and multi-source import (lines 560-763):

```python
class TemplateImportService:
    def scan_import_directory(self, import_dir: Path = None) -> TemplateScanImportResponse
    def import_from_yaml_bulk(self, yaml_file_paths: list[str], overwrite: bool, created_by: str) -> TemplateImportResponse
    def import_from_file_bulk(self, file_contents: list[dict], overwrite: bool, created_by: str) -> TemplateImportResponse
    def import_from_git(self, git_repo_id: int, overwrite: bool) -> TemplateImportResponse
    def _parse_yaml_file(self, yaml_file: Path) -> ImportableTemplateInfo
    def _resolve_absolute_path(self, relative_path: str) -> Path
    def _check_duplicate(self, template_name: str) -> bool
```

**Key fixes during extraction:**
- Remove debug `print()` statements (lines 140-150, 167-169, 180-182, 590, 596, 618, 629)
- De-duplicate file extension filtering (lines 456-458 vs 700-704)
- De-duplicate duplicate-detection logic (lines 661-670 vs 722-728)
- Fix fragile path resolution (lines 607-631 — hard-coded walk-up from `__file__`)

#### `/backend/services/settings/templates/render_service.py` (~150 lines)

Absorbs advanced rendering (lines 766-907):

```python
class TemplateRenderService:
    async def render_template(self, template_content: str, category: str, context: dict, ...) -> AdvancedTemplateRenderResponse
    async def _render_netmiko_template(self, template_content: str, context: dict, pre_run_command: str, ...) -> tuple
    async def _execute_pre_run_command(self, device_id: int, command: str, credential_id: int) -> dict
    def _extract_template_variables(self, template_content: str) -> list[str]
    def _render_jinja2(self, template_content: str, context: dict) -> str
```

**Key fixes:**
- Remove category-specific branching from router (if category == "netmiko" / "agent")
- Encapsulate Jinja2 error handling
- Encapsulate variable extraction regex

#### `/backend/services/settings/templates/authorization_service.py` (~40 lines)

Absorbs permission check (lines 304-320):

```python
class TemplateAuthorizationService:
    def check_edit_permission(self, current_user: dict, template: dict) -> bool
```

**Key fix:** Replace magic number `16` for admin permission bit with proper RBAC check.

#### `/backend/services/settings/templates/type_inference.py` (~30 lines)

Absorbs duplicated file type inference:

```python
def infer_from_extension(filename: str, default_type: str = "jinja2", default_category: str = None) -> tuple[str, str]
```

### After Refactoring

Router: ~250 lines (from 923). All import/render/permission logic in services.

---

## Step 4: Extract `routers/jobs/celery_api.py` (814 lines, 45% logic)

### Current State

23 endpoints with 4 business logic blocks:

| Endpoint | Function | Lines | Issue |
|---|---|---|---|
| `GET /queues` | `list_queues` | 156-232 | **77 lines** — queue metrics aggregation with Redis |
| `DELETE /queues/{name}/purge` | `purge_queue` | 235-285 | **51 lines** — Kombu queue operations |
| `DELETE /queues/purge-all` | `purge_all_queues` | 288-343 | **56 lines** — duplicates purge logic |
| `GET /status` | `celery_status` | 391-430 | **40 lines** — status aggregation, duplicate Redis connections |
| `PUT /settings` | `update_celery_settings` | 725-771 | **47 lines** — queue validation, built-in queue protection |

### Target Services

**Create 4 new services under `/backend/services/celery/`:**

#### `/backend/services/celery/queue_metrics_service.py` (~100 lines)

```python
class CeleryQueueMetricsService:
    def list_queue_metrics(self) -> list[QueueMetrics]
    def _get_pending_count(self, queue_name: str) -> int          # Redis llen
    def _get_workers_consuming(self, queue_name: str) -> list[str] # Celery inspect
    def _get_active_count(self, queue_name: str, workers: list[str]) -> int
    def _get_routed_tasks(self, queue_name: str) -> list[str]
```

#### `/backend/services/celery/queue_operations_service.py` (~80 lines)

```python
class CeleryQueueOperationsService:
    def purge_queue(self, queue_name: str) -> int
    def purge_all_queues(self) -> dict[str, int]
    def _construct_queue_object(self, queue_name: str) -> Queue    # Kombu Queue
    def _validate_queue_name(self, queue_name: str) -> bool
```

**Key fix:** De-duplicate queue construction logic (appears in both purge_queue and purge_all_queues).

#### `/backend/services/celery/status_service.py` (~60 lines)

```python
class CeleryStatusService:
    def get_system_status(self) -> CelerySystemStatus
    def _get_worker_stats(self) -> dict
    def _check_redis_connected(self) -> bool
    def _check_beat_running(self) -> bool
```

**Key fix:** Single Redis connection instead of creating two separate clients (lines 408-420).

#### `/backend/services/celery/settings_service.py` (~50 lines)

```python
class CelerySettingsService:
    def update_settings(self, updates: dict) -> dict
    def _validate_queue_config(self, queues: list[dict]) -> None
    def _get_built_in_queue_names(self) -> set[str]
```

**Key fix:** Remove hard-coded built-in queue names (`{"default", "backup", "network", "heavy"}`), load from config.

### After Refactoring

Router: ~420 lines (from 814). Redis/Kombu/Celery internals centralized in services.

---

## Step 5: Extract `routers/jobs/runs.py` (493 lines, 50% logic)

### Current State

11 endpoints with business logic blocks:

| Endpoint | Function | Lines | Issue |
|---|---|---|---|
| `GET /job-runs` | `list_job_runs` | 19-73 | Filter parsing (9 lines, duplicated) |
| `GET /job-runs/{run_id}/progress` | `get_job_progress` | 166-229 | **64 lines** — Redis progress lookup, percentage calc |
| `POST /job-runs/{run_id}/cancel` | `cancel_job_run` | 251-291 | **41 lines** — Celery revocation + DB update |
| `DELETE /job-runs/clear-filtered` | `clear_filtered_runs` | 327-387 | **61 lines** — duplicated filter parsing |
| `POST /job-runs/execute/{schedule_id}` | `execute_job_manually` | 423-492 | **70 lines** — schedule validation, dispatch |

### Target Services

**Create under `/backend/services/jobs/`:**

#### `/backend/services/jobs/progress_service.py` (~70 lines)

```python
class JobProgressService:
    def get_progress(self, run_id: int) -> JobProgress
    def _calculate_percentage(self, completed: int, total: int) -> int
    def _format_progress_message(self, completed: int, total: int) -> str
```

Centralizes Redis progress key access (`datenschleuder:job-progress:{run_id}`).

#### `/backend/services/jobs/execution_service.py` (~120 lines)

```python
class JobExecutionService:
    def execute_schedule_manually(self, schedule_id: int, executed_by: str) -> JobDispatchResult
    def cancel_job(self, run_id: int) -> JobRun
    def _validate_schedule_has_template(self, schedule: dict) -> None
    def _map_schedule_to_job_params(self, schedule: dict, template: dict, executed_by: str) -> dict
    def _can_cancel(self, job_status: str) -> bool
    def _revoke_celery_task(self, celery_task_id: str) -> None
```

#### `/backend/services/jobs/filter_service.py` (~30 lines)

```python
def parse_comma_separated_filters(
    status: str = None, job_type: str = None,
    triggered_by: str = None, template_id: str = None
) -> dict:
    """Parse query parameters into filter lists."""
```

De-duplicates filter parsing that appears at lines 51-59 and 349-357.

### After Refactoring

Router: ~250 lines (from 493).

---

## Step 6: Extract `routers/jobs/schedules.py` (468 lines, 55% logic)

### Current State

8 endpoints with business logic blocks:

| Endpoint | Function | Lines | Issue |
|---|---|---|---|
| `POST /job-schedules` | `create_job_schedule` | 24-77 | **16 lines** permission check |
| `PUT /job-schedules/{id}` | `update_job_schedule` | 144-198 | **13 lines** permission check |
| `DELETE /job-schedules/{id}` | `delete_job_schedule` | 201-246 | **14 lines** permission check |
| `POST /job-schedules/execute` | `execute_job` | 249-333 | **85 lines** — execution workflow with parameter merging |
| `GET /debug/scheduler-status` | `get_scheduler_debug_status` | 336-442 | **107 lines** — comprehensive scheduler diagnostics |

### Target Services

#### `/backend/services/jobs/schedule_authorization_service.py` (~60 lines)

```python
class JobScheduleAuthorizationService:
    def check_create_permission(self, current_user: dict, is_global: bool) -> bool
    def check_update_permission(self, current_user: dict, job: dict) -> bool
    def check_delete_permission(self, current_user: dict, job: dict) -> bool
    def check_access_permission(self, current_user: dict, job: dict) -> bool
```

**Key fix:** Replace fragile `current_user.get("role") == "admin"` pattern with proper `rbac_service.has_permission()` calls. Permission check duplicated 3 times (create/update/delete) with slight variations.

#### Extend `/backend/services/jobs/execution_service.py` (from Step 5)

Add:
```python
def execute_schedule(self, schedule_id: int, executed_by: str, override_parameters: dict = None) -> JobDispatchResult
def _merge_job_parameters(self, base_params: dict, overrides: dict) -> dict
```

#### `/backend/services/jobs/scheduler_debug_service.py` (~100 lines)

```python
class JobSchedulerDebugService:
    def get_scheduler_status(self) -> SchedulerDebugInfo
    def _get_schedule_info(self, schedule: dict, now_utc: datetime) -> ScheduleInfo
    def _parse_next_run_time(self, next_run) -> datetime
    def _calculate_time_until_run(self, next_run_dt: datetime, now_utc: datetime) -> tuple[int, bool]
    def _check_celery_beat_status(self) -> str
```

### After Refactoring

Router: ~200 lines (from 468).

---

## Step 7: Clean Up `routers/settings/rbac.py` (695 lines, 40% logic)

### Current State

41 endpoints — mostly well-structured but with duplicated patterns:

**Duplicated access control check (4 times, ~48 lines):**
- Lines 259-266, 321-327, 349-355, 411-417
- Pattern: check if current user owns resource or is admin

**Duplicated permission source determination (2 times, ~42 lines):**
- Lines 421-441, 469-488
- Pattern: check if permission comes from override or role

### Target Changes

#### Create helper `/backend/services/auth/rbac_helpers.py` (~40 lines)

```python
def verify_user_access(current_user: dict, target_user_id: int, rbac_service, allow_self: bool = True) -> bool:
    """Verify current user can access target user's data."""

def check_permission_with_source(rbac_service, user_id: int, resource: str, action: str) -> PermissionCheckResult:
    """Check permission and determine if from override or role."""
```

#### Update Router

Replace 4 duplicated access control blocks → single `verify_user_access()` call each.
Replace 2 duplicated permission source blocks → single `check_permission_with_source()` call each.

### After Refactoring

Router: ~660 lines (from 695). Small improvement but eliminates duplication.

**Note:** This router is already reasonably well-structured. The refactoring here is minor compared to Steps 1-6. After Phase 1 replaces `rbac_manager` with `RBACService`, the main work is just extracting duplicated helper patterns.

---

## Execution Order

```
Step 1: git/debug.py     → Most isolated, highest logic %, proves the pattern
Step 2: git/files.py     → Same domain, builds on git service pattern
Step 3: templates.py     → Independent domain, large payoff
Step 4: celery_api.py    → Independent domain, Celery/Redis centralization
Step 5: jobs/runs.py     → Depends on Step 4 partially (execution service)
Step 6: jobs/schedules.py → Depends on Step 5 (shared execution service)
Step 7: rbac.py          → Minor cleanup, do last
```

Steps 1-2 (git) and 3-4 (templates/celery) can be done in parallel.

---

## Verification Checklist

After each step:

1. **All endpoints respond correctly** — test with actual HTTP requests or curl
2. **No business logic in router** — each endpoint ≤15 lines (parse → call → format)
3. **Services are independently testable** — can instantiate with mock DB
4. **No direct Redis/Celery/filesystem access in routers** — only through services
5. **No duplicate code** — grep for known duplicated patterns

After all steps:

- [ ] No router file exceeds 400 lines
- [ ] No router endpoint exceeds 20 lines
- [ ] All Redis access is in services, not routers
- [ ] All Git operations are in services, not routers
- [ ] All Celery operations are in services, not routers
- [ ] All file I/O is in services, not routers
- [ ] `routers/nifi/operations.py` remains untouched (reference implementation)
- [ ] All debug `print()` statements removed (found in templates.py)

---

## Files Created (Summary)

```
NEW:
  services/settings/git/debug_service.py           (~350 lines)
  services/settings/git/file_search_service.py     (~80 lines)
  services/settings/git/file_history_service.py    (~120 lines)
  services/settings/git/directory_service.py       (~150 lines)
  services/settings/templates/import_service.py    (~200 lines)
  services/settings/templates/render_service.py    (~150 lines)
  services/settings/templates/authorization_service.py (~40 lines)
  services/settings/templates/type_inference.py    (~30 lines)
  services/celery/queue_metrics_service.py         (~100 lines)
  services/celery/queue_operations_service.py      (~80 lines)
  services/celery/status_service.py                (~60 lines)
  services/celery/settings_service.py              (~50 lines)
  services/jobs/progress_service.py                (~70 lines)
  services/jobs/execution_service.py               (~120 lines)
  services/jobs/filter_service.py                  (~30 lines)
  services/jobs/schedule_authorization_service.py  (~60 lines)
  services/jobs/scheduler_debug_service.py         (~100 lines)
  services/auth/rbac_helpers.py                    (~40 lines)

MODIFIED (reduced):
  routers/settings/git/debug.py      750 → ~50 lines
  routers/settings/git/files.py      971 → ~320 lines
  routers/settings/templates.py      923 → ~250 lines
  routers/jobs/celery_api.py         814 → ~420 lines
  routers/jobs/runs.py               493 → ~250 lines
  routers/jobs/schedules.py          468 → ~200 lines
  routers/settings/rbac.py           695 → ~660 lines

UNTOUCHED:
  routers/nifi/operations.py         932 lines (reference implementation)

NET: ~5,114 router lines → ~2,150 lines (60% reduction)
     ~1,880 lines of new services created
     Business logic cleanly separated and independently testable
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Endpoint behavior changes subtly | MEDIUM | HIGH | Test each endpoint before/after with same inputs |
| Exception mapping changes HTTP status codes | MEDIUM | MEDIUM | Map all service exceptions → HTTP in router |
| Async context lost during extraction | LOW | HIGH | Verify async/await preserved for async services |
| Git auth context managers break when moved | MEDIUM | HIGH | Test push/commit operations specifically |
| Celery task dispatch parameters change | LOW | HIGH | Compare dispatch_job.delay() args before/after |
| Redis key names differ in new services | LOW | MEDIUM | Use constants for Redis key patterns |
