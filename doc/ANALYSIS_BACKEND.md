# Backend Code Analysis

**Date:** 2026-04-24  
**Scope:** `/backend/` — full Python codebase  
**Standard:** CLAUDE.md architectural requirements

---

## Summary

The codebase is in good architectural shape overall. The layered pattern (Router → Service → Repository → Model) is consistently applied across ~95% of files. No SQLite, no f-string logging, no true God Objects. Four priority issues require attention, plus a scattered Pydantic model problem.

**Effort estimate:** 2–3 days for Priority 1 & 2 items.

---

## Codebase Statistics

| Metric | Value |
|---|---|
| Total Python files | 183 |
| Total lines | ~44,200 |
| Files over 400 lines | 22 |
| Registered routers | 32 |
| Repositories | 43 |

---

## Compliant Areas

### Architecture
- Router → Service → Repository → SQLAlchemy chain is followed in the vast majority of files.
- `/backend/repositories/base.py` provides a well-typed `BaseRepository[T]` with generic CRUD.
- Specialized repositories per domain: `auth/`, `jobs/`, `nifi/`, `settings/`.
- `main.py` uses a clean lifespan pattern with `service_factory.build_*()` for initialization.

### Database
- PostgreSQL exclusively — no SQLite anywhere.
- Connection via SQLAlchemy with pool_size=5, max_overflow=10, pool_recycle=3600.
- No raw DDL in production paths (except NiFi dynamic tables, see below).

### Logging
- Zero f-string logging found. All calls use parameterized format:
  ```python
  logger.info("NiFi instance %d unreachable (attempt %d/%d): %s", id, n, max, err)
  ```

### Core Models
- `/backend/core/models/` is split into focused per-domain files (`auth.py`, `jobs.py`, `nifi.py`, etc.), totalling ~1,300 lines across 11 files. Each file is well within size limits.

### Service Cohesion
- Large services (`git/service.py` at 792 lines, `nifi_flow_service.py` at 602 lines) are large but focused — single domain, cohesive responsibility. Not God Objects.

---

## Issues Found

### Priority 1 — Critical (Repository Pattern Violations)

#### 1. Raw SQL in `job_run_service.py`

**File:** `/backend/services/jobs/job_run_service.py` ~line 126  
**Issue:** `get_dashboard_stats()` executes raw SQL with `session.execute(text(...))` instead of using `JobRunRepository`.

```python
# Current — bypasses repository
job_stats = session.execute(text("""
    SELECT COUNT(*) as total,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, ...
"""))
```

**Fix:** Add `get_dashboard_statistics()` to `JobRunRepository` using SQLAlchemy ORM aggregations (`func.count`, `func.sum`, `case`), then call that from the service.

---

#### 2. Direct DB access in `settings_service.py`

**File:** `/backend/services/settings/settings_service.py` ~line 280  
**Issue:** `reset_to_defaults()` calls `session.query(GitSetting).delete()` and similar direct ORM calls, bypassing the repository layer.

**Fix:** Delegate to `GitSettingRepository.delete_all()`, `CacheSettingRepository.delete_all()`, `CelerySettingRepository.delete_all()`. These methods may need to be added to the respective repositories.

---

#### 3. Duplicate DB access in `flow_view_service.py`

**File:** `/backend/services/nifi/flow_view_service.py` ~line 75  
**Issue:** `_unset_all_defaults()` and `_unset_all_defaults_except()` access the DB directly. `FlowViewRepository` already has a `set_default()` method at line 39–51 that covers this. The service duplicates that logic.

**Fix:** Remove the private methods from the service; call the existing repository method instead.

---

#### 4. Raw SQL in `install_service.py` and `hierarchy_service.py`

**Files:**
- `/backend/services/nifi/install_service.py` ~line 33 — `conn.execute(text("SELECT * FROM nifi_flows"))`
- `/backend/services/nifi/hierarchy_service.py` ~line 71, 92 — `DROP TABLE IF EXISTS nifi_flows`, `SELECT COUNT(*)`

**Note on hierarchy_service:** The DDL operations (CREATE/DROP TABLE) are schema management for a dynamic NiFi table, which is a borderline case. The SELECT COUNT(*) should still go through the repository.

**Fix for install_service:** Replace with `NifiFlowRepository.get_all()`.  
**Fix for hierarchy_service:** Move DDL operations to a dedicated `NifiFlowSchemaRepository` or a migration helper; replace SELECT with `NifiFlowRepository.count()`.

---

### Priority 2 — Medium (Code Quality)

#### 5. Pydantic models scattered across router files

**Issue:** 27 Pydantic request/response models are defined inline in router files instead of `/backend/models/`. This makes them hard to discover, reuse, or test independently.

**Affected files:**

| File | Models defined |
|---|---|
| `/backend/routers/jobs/celery_api.py` | 9 (TestTaskRequest, TaskResponse, etc.) |
| `/backend/routers/certificates.py` | 4 (CertificateInfo, ScanResponse, etc.) |
| `/backend/routers/nifi/certificates.py` | 5 (CertificatesResponse, ReadStoreRequest, etc.) |
| `/backend/routers/auth/profile.py` | 3 (PersonalCredentialData, ProfileResponse, etc.) |
| `/backend/routers/settings/git/files.py` | 2 — `WriteFileRequest` defined **twice** (lines 131 and 401) |
| `/backend/routers/nifi/install.py` | 2 (PathStatus, CheckPathResponse) |
| `/backend/routers/tools.py` | 1 (CertificateEntry) |
| `/backend/services/nifi/certificate_manager.py` | 1 (CertificateConfig) |

**Duplicate model:** `WriteFileRequest` is defined twice in `git/files.py` — one definition is dead code.

**Fix:** Move models to the appropriate file under `/backend/models/` (e.g., `models/jobs.py`, `models/nifi.py`, `models/auth.py`). Update imports. The duplicate `WriteFileRequest` should be removed.

---

### Priority 3 — Low (Maintainability)

#### 6. Router files with embedded helper logic

**Files:**
- `/backend/routers/nifi/operations.py` (944 lines) — contains `_execute_with_retry()`, `_get_instance()` helpers. These are not business logic per se, but they inflate the router file significantly.
- `/backend/routers/jobs/celery_api.py` (582 lines) — large partly due to the 9 inline Pydantic models (see issue 5).
- `/backend/routers/settings/rbac.py` (619 lines) — large but delegates correctly to service.

**Fix:** After moving inline models out (issue 5), `celery_api.py` will shrink naturally. For `nifi/operations.py`, consider extracting `_execute_with_retry` and `_get_instance` to a `nifi_router_helpers.py` module.

---

#### 7. `main.py` size

**File:** `/backend/main.py` (468 lines)  
**Issue:** Borderline large. Contains router imports, middleware, lifespan, and startup logic.  
**Fix (optional):** Extract startup/initialization logic into `/backend/core/startup.py` to keep `main.py` focused on the ASGI app wiring.

---

## Files Over 400 Lines

| File | Lines | Status |
|---|---|---|
| `/backend/routers/nifi/operations.py` | 944 | Refactor (issue 6) |
| `/backend/services/settings/git/service.py` | 792 | Acceptable — cohesive domain |
| `/backend/scripts/convert_fstring_logging.py` | 771 | Utility script — exempt |
| `/backend/models/nifi.py` | 706 | Acceptable — Pydantic models |
| `/backend/routers/settings/rbac.py` | 619 | Acceptable — delegates correctly |
| `/backend/services/nifi/nifi_flow_service.py` | 602 | Acceptable — cohesive domain |
| `/backend/services/settings/git/debug_service.py` | 584 | Acceptable |
| `/backend/routers/jobs/celery_api.py` | 582 | Refactor (issue 5 shrinks it) |
| `/backend/tools/seed_rbac.py` | 552 | Utility — exempt |
| `/backend/routers/settings/git/files.py` | 550 | Refactor (issue 5 + duplicate model) |
| `/backend/routers/auth/oidc.py` | 504 | Acceptable — complex OIDC flow |
| `/backend/repositories/jobs/job_run_repository.py` | 488 | Acceptable |
| `/backend/routers/settings/templates.py` | 482 | Acceptable |
| `/backend/services/nifi/operations/process_groups.py` | 470 | Acceptable |
| `/backend/main.py` | 468 | Low priority (issue 7) |
| `/backend/services/settings/cache.py` | 467 | Acceptable — cohesive domain |
| `/backend/services/settings/git/operations.py` | 456 | Acceptable |
| `/backend/routers/settings/git/operations.py` | 435 | Acceptable |
| `/backend/tasks/execution/export_flows_executor.py` | 430 | Acceptable |
| `/backend/services/settings/git/cache.py` | 427 | Acceptable |
| `/backend/services/pki_service.py` | 422 | Acceptable |

---

## Refactoring Checklist

### Priority 1 (do first)

- [ ] `job_run_service.py` — extract raw SQL to `JobRunRepository.get_dashboard_statistics()`
- [ ] `settings_service.py` — replace direct ORM calls in `reset_to_defaults()` with repository delegates
- [ ] `flow_view_service.py` — remove `_unset_all_defaults*()` methods; use `FlowViewRepository.set_default()`
- [ ] `install_service.py` — replace raw SELECT with `NifiFlowRepository.get_all()`
- [ ] `hierarchy_service.py` — move DDL to schema helper; replace COUNT with `NifiFlowRepository.count()`

### Priority 2 (next sprint)

- [ ] Move 27 scattered Pydantic models from router files to `/backend/models/`
- [ ] Remove duplicate `WriteFileRequest` in `git/files.py`
- [ ] Update all affected imports after model moves

### Priority 3 (backlog)

- [ ] Extract helper functions from `nifi/operations.py` to reduce router file size
- [ ] Consider splitting `main.py` startup logic into `core/startup.py`
