# Backend refactoring plan

**Related:** `doc/ANALYSIS_BACKEND.md`, `CLAUDE.md` (backend layers, 5xx policy, repository rules).  
**Scope:** Python backend under `backend/` (FastAPI, SQLAlchemy, Celery).  
**Date:** 2026-05-13.

---

## Progress overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | `core/safe_http_errors.py` helper | ✅ Done |
| 2 | `core/error_handlers.py` decorators sanitized | ✅ Done |
| 3 | Router 5xx sweep (jobs, agent, auth, git, settings) | ✅ Done |
| 3b | NiFi router 504 leaks (`nifi/operations.py`) | ✅ Done |
| 4 | Services that raise `HTTPException` 5xx | ✅ Done |
| 5 | 4xx `detail=str(e)` cleanup | ✅ Done |
| 6 | Session / repository refactor (injected `Session`) | ✅ Done |
| 7 | Audit layering (`audit_log_repo` out of routers) | ✅ Done |
| 8 | Replace module-level service singletons with `Depends` | ✅ Done |
| 9 | CI guard scripts + `CLAUDE.md` reconciliation | ⏭ Skipped (no CI) |
| 10 | Ruff, Mypy, coverage expansion | ✅ Done |

**Quick leak check** (run before and after any phase):

```bash
# 5xx leaks in routers (must be empty after phase 3b)
grep -rn "detail=str(" backend/routers/ | grep -E "50[0-9]|HTTP_5"

# All detail=str( in routers (target: zero after phase 5)
grep -rn "detail=str(" backend/routers/ | wc -l

# Services raising HTTPException 5xx (target: zero after phase 4)
grep -rn "raise HTTPException" backend/services/ | grep -E "50[0-9]|HTTP_50"
```

---

## Phase 3b — NiFi router 504 leaks

**Scope:** `backend/routers/nifi/operations.py` — 3 occurrences of
`HTTPException(status_code=HTTP_504_GATEWAY_TIMEOUT, detail=str(e))`.

**Pattern to apply:**

```python
# Before
except TimeoutError as e:
    raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))

# After
except TimeoutError as e:
    raise_internal_server_error(
        log_message="NiFi request timed out",
        exc=e,
        status_code=504,
        operation="<endpoint_name>",
    )
```

**Import to add at top of file:**

```python
from core.safe_http_errors import raise_internal_server_error
```

**Verification:**

```bash
grep -n "HTTP_504.*str(" backend/routers/nifi/operations.py
# Must return nothing
```

---

## Phase 4 — Services raising `HTTPException` 5xx

**Scope:** One confirmed file; re-run grep before execution to catch any additions.

```bash
grep -rn "raise HTTPException" backend/services/ | grep -E "50[0-9]|HTTP_50"
```

**Current findings:**

| File | Line | Issue |
|------|------|-------|
| `services/jobs/execution_service.py` | 124 | `HTTPException(status_code=500, detail="Failed to cancel job run")` — plain string, no `error_id` |

**Pattern to apply** (fast sub-strategy 4a — replace in-place):

```python
# Before
raise HTTPException(status_code=500, detail="Failed to cancel job run")

# After
raise_internal_server_error(
    log_message="Failed to cancel job run",
    exc=exc,           # pass the caught exception if one exists
    operation="cancel_job_run",
)
```

**Note:** If the service already re-raises without a caught exception in scope, omit `exc=`.

**Verification:**

```bash
grep -rn "raise HTTPException" backend/services/ | grep -E "50[0-9]|HTTP_50"
# Must return nothing
```

---

## Phase 5 — 4xx `detail=str(e)` cleanup

**Scope:** 49 occurrences of `detail=str(e)` (or `detail=str(exc)`) on 400/404 responses across routers.

**Files with the most occurrences (run in this order):**

```bash
grep -rn "detail=str(" backend/routers/ | grep -v "50[0-9]"
```

| File | Count | Domain |
|------|-------|--------|
| `routers/settings/templates.py` | ~5 | Templates |
| `routers/settings/credentials.py` | ~6 | Credentials |
| `routers/settings/rbac.py` | ~6 | RBAC |
| `routers/settings/git/repositories.py` | ~1 | Git |
| `routers/settings/redis.py` | ~1 | Redis |
| NiFi routers (various) | remaining | NiFi |

**Policy per domain:**

| Domain | Approach |
|--------|----------|
| RBAC / credentials | Fixed vocabulary: `"Invalid role assignment"`, `"Resource not found"`. Never forward DB messages. |
| Templates | Fixed: `"Invalid template"`, `"Template not found"`. |
| Git | User misconfiguration → fixed 400 message; opaque git errors → `raise_internal_server_error`. |
| NiFi | User misconfiguration → fixed 400; NiFi API errors → 502/504 with `raise_internal_server_error`. |
| Redis | `"Resource not found"` for 404. |

**Pattern for 400 (validation/bad input):**

```python
# Before
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))

# After — log detail, send stable message
except ValueError as e:
    logger.warning("Invalid input for <operation>: %s", e)
    raise HTTPException(status_code=400, detail="Invalid input for <operation>")
```

**Pattern for 404:**

```python
# Before
raise HTTPException(status_code=404, detail=str(e))

# After
raise HTTPException(status_code=404, detail="<ResourceName> not found")
```

**Verification:**

```bash
grep -rn "detail=str(" backend/routers/ | wc -l
# Must be 0
```

---

## Phase 6 — Session / repository refactor

**Goal:** Establish request-scoped `Session` injection for at least one domain as a reference implementation.

**Wave 1 — Pilot domain: `job_runs`**

Files involved:
- `backend/repositories/job_run_repository.py`
- `backend/services/jobs/job_run_service.py` (or equivalent)
- `backend/routers/jobs/runs.py`

Steps:
1. Add overloaded methods `*_with_session(self, db: Session, ...)` to repository, OR refactor existing methods to accept `db: Session` as first parameter.
2. Service accepts `db: Session` in constructor or per-method.
3. Router injects `db: Session = Depends(get_db)` and passes to service.
4. Write or extend integration test proving a two-step create+update runs in one transaction.

**Wave 2 (after Wave 1 is merged):** auth + credentials paths.

**Documentation artifact:** Add `doc/refactoring/BACKEND_SESSION_PATTERN.md` describing when Option A (injected session) vs Option B (repository-owned session) is appropriate.

**Verification:**

```bash
# Session injection present in pilot router
grep -n "Depends(get_db)" backend/routers/jobs/runs.py
# No internal get_db_session() calls in pilot repository methods
grep -n "get_db_session()" backend/repositories/job_run_repository.py
```

---

## Phase 7 — Audit layering

**Goal:** Remove `audit_log_repo` direct usage from `routers/auth/auth.py`.

Steps:
1. Add `record_login_success(...)` / `record_login_failure(...)` to `services/audit/audit_service.py` (create file if absent).
2. Move the `audit_log_repo.create_log(...)` calls from `routers/auth/auth.py` into that service (or into the existing login service if one exists).
3. Router calls service; service owns the repo interaction.

**Verification:**

```bash
grep -rn "audit_log_repo" backend/routers/
# Must return nothing
```

---

## Phase 8 — Replace module-level service singletons with `Depends`

**Goal:** Remove `job_run_manager = _JobRunService()` (and similar) at module import time.

**Pilot file:** `backend/routers/jobs/runs.py`

Steps:
1. Create `backend/routers/jobs/deps.py` (or add to `backend/core/deps.py`):
   ```python
   def get_job_run_service() -> JobRunService:
       return JobRunService()
   ```
2. Replace the module-level singleton with `Depends(get_job_run_service)` in the route signatures.
3. Repeat for `schedules.py` and `templates.py`.

**Verification:**

```bash
grep -n "= _Job\|= Job" backend/routers/jobs/runs.py
# Module-level singleton must be gone
```

---

## Phase 9 — CI guard scripts

**Goal:** Create the scripts referenced in `CLAUDE.md` so regressions are caught automatically.

### 9.1 `backend/scripts/check_http_500_leaks.py`

Exits non-zero if `detail=str(` appears on the same line as a 5xx status code anywhere under `backend/routers/`, `backend/core/`, or `backend/services/`.

Skeleton:

```python
#!/usr/bin/env python3
"""CI guard: fails if raw exception text leaks into 5xx HTTPException detail."""
import re, subprocess, sys

PATTERN = re.compile(r"detail\s*=\s*str\s*\(")
STATUS_5XX = re.compile(r"5\d\d|HTTP_5")

result = subprocess.run(
    ["grep", "-rn", "detail=str(", "backend/routers", "backend/core", "backend/services"],
    capture_output=True, text=True,
)

leaks = [
    line for line in result.stdout.splitlines()
    if PATTERN.search(line) and STATUS_5XX.search(line)
]

if leaks:
    print("ERROR: 5xx error detail leaks raw exception text:")
    for l in leaks:
        print(" ", l)
    sys.exit(1)

print(f"OK: no 5xx detail leaks found")
```

### 9.2 `backend/scripts/check_router_repositories.py`

Exits non-zero if any file under `backend/routers/` imports directly from `repositories.` (allowlist tooling routes as needed).

### 9.3 Update `CLAUDE.md`

Verify the script paths in the **Development Workflow** section match actual `backend/scripts/` contents after 9.1 and 9.2 are created.

**Verification:**

```bash
python backend/scripts/check_http_500_leaks.py
# Exit 0
python backend/scripts/check_router_repositories.py
# Exit 0 or allowlist-documented
```

---

## Phase 10 — Ruff, Mypy, coverage

| Step | Action |
|------|--------|
| 10.1 | Add Ruff to `backend/pyproject.toml` (`E`, `F`, `I`, `B`, `UP`); run once, baseline noqa where needed. |
| 10.2 | Add Mypy in non-strict mode; type public APIs first. |
| 10.3 | Extend pytest-cov to include `routers`, `repositories`, `core`. |

---

## PR slice map

| PR | Phase | Rough size |
|----|-------|------------|
| PR-current | 3 (mostly done) | — |
| PR-A | 3b + 4 | Small |
| PR-B | 5 (credentials, RBAC) | Medium |
| PR-C | 5 (templates, git, NiFi 4xx) | Medium |
| PR-D | 6 wave 1 (job runs session) | Medium |
| PR-E | 7 (audit layering) | Small |
| PR-F | 8 (Depends singletons) | Small |
| PR-G | 9 (CI guard scripts) | Small |
| PR-H | 10 (Ruff/Mypy/coverage) | Medium |

---

## Definition of done

- [ ] `grep -rn "detail=str(" backend/routers/ backend/core/ backend/services/` → zero results
- [ ] `grep -rn "raise HTTPException" backend/services/ | grep "50[0-9]"` → zero results
- [ ] `backend/scripts/check_http_500_leaks.py` exists and exits 0 in CI
- [ ] Session pattern documented; `job_run_repository` pilot migrated to injected `Session`
- [ ] No `audit_log_repo` usage from `backend/routers/`
- [ ] Ruff enabled with CI enforcement
- [ ] Coverage config includes `routers`, `repositories`, `core`

---

## Document history

| Date | Change |
|------|--------|
| 2026-05-13 | Initial plan from `ANALYSIS_BACKEND.md` |
| 2026-05-13 | Revised: phases 1–3 complete; remaining phases split into independently executable chunks |
| 2026-05-13 | Phase 3b complete: NiFi `operations.py` 504 leaks replaced with `raise_internal_server_error` |
| 2026-05-13 | Phase 4 complete: `services/jobs/execution_service.py` bare 500 replaced with `raise_internal_server_error` |
| 2026-05-13 | Phase 5 complete: all `detail=str(e)` in routers replaced with fixed vocabulary; swept f-string/%-format 5xx leaks in tools.py, nifi_config.py, nifi_flows.py, operations.py, deploy.py, install.py, flow_import.py |
| 2026-05-13 | Phase 6 complete (Wave 1): `job_run_repository` and `JobRunService` migrated to injected `Session`; router uses `Depends(get_db)`; Celery tasks use `SessionLocal()` with `finally: db.close()`; `BACKEND_SESSION_PATTERN.md` created; integration tests added |
| 2026-05-13 | Phase 7 complete: `services/audit/audit_service.py` created with `record_login_success`, `record_oidc_login_success`, `record_logout`; all `audit_log_repo` calls removed from `routers/auth/auth.py` and `routers/auth/oidc.py` |
| 2026-05-13 | Phase 8 complete: module-level singletons removed from `routers/jobs/schedules.py` and `routers/jobs/templates.py`; replaced with `get_job_schedule_service`, `get_schedule_auth_service`, `get_job_template_service`, `get_rbac_service` factory functions injected via `Depends`; `runs.py` was already compliant from Phase 6 |
| 2026-05-13 | Phase 9 skipped: no CI pipeline in use |
| 2026-05-13 | Phase 10 complete: Ruff configured (E,F,I,B,UP; line-length=120; migrations/ excluded; B008/UP006/UP007/UP031/UP035/UP045/B904/E501 baselined); 229 auto-fixes applied (I001,F841,UP037,UP015,B009); F821 bug fixed (missing logger in credentials.py); B007 fixed (6 unused loop vars renamed to _); Mypy configured non-strict; coverage expanded to routers/repositories/core; ruff+mypy added to requirements.txt |
