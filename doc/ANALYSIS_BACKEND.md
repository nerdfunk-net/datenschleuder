# Backend analysis — CLAUDE.md standards and Python practices

**Scope:** `backend/` Python service (FastAPI, SQLAlchemy, Celery).  
**Reference:** `CLAUDE.md` (architectural standards, security rules, naming, database policy).  
**Date:** 2026-05-13.

## Executive summary

The backend largely follows the documented **Model → Pydantic → Repository → Service → Router** flow for persistence-heavy domains (jobs, settings, NiFi, auth data). **PostgreSQL**, **Alembic-style versioned migrations** under `backend/migrations/`, and **JWT plus `require_permission`** are in active use. Gaps are concentrated in **consistent error handling for server faults**, **documentation vs. code drift** (referenced helpers and guard scripts), **session lifecycle patterns** (global sessions in repositories vs. request-scoped `Depends(get_db)`), and **tooling** (no declared Ruff/Mypy in `backend/pyproject.toml`).

---

## 1. CLAUDE.md architectural standard

### 1.1 Layered backend (Model → Repository → Service → Router)

| Expectation | Observation |
|-------------|---------------|
| SQLAlchemy in `core/models/{domain}.py` | **Met.** Domain modules and `core/models/__init__.py` re-export models as documented. |
| Pydantic in `models/{domain}.py` | **Met** for major areas (`models/auth.py`, `models/jobs.py`, NiFi, settings, etc.). |
| Repository in `repositories/` | **Mostly met.** Repositories exist for jobs, auth, settings, NiFi, agent, PKI, audit. **Not every conceptual domain** may have a dedicated repository file; layout uses subpackages (`repositories/auth/`, `repositories/jobs/`) rather than only flat `{domain}_repository.py` — consistent with snake_case and maintainability. |
| Service in `services/` | **Met** for core flows. NiFi and settings are decomposed into submodules (aligned with CLAUDE.md Nautobot-style guidance for complex integrations). |
| Thin routers | **Mostly met.** Routers generally call services or small facades. **Exceptions:** `routers/auth/auth.py` calls `audit_log_repo.create_log` directly inside the login handler (repository from router, skipping a dedicated audit *service* for that path). `routers/tools.py` and similar admin utilities orchestrate managers/helpers directly — acceptable for tooling but not the strict “router → service only” line. |
| `main.py` registers routers | **Met.** `backend/main.py` includes modular routers. |

### 1.2 Repository layer and database access

| Expectation | Observation |
|-------------|---------------|
| Prefer ORM/Core; `text()` only in repositories per `doc/refactoring/REFACTORING_RAW_SQL.md` | **Largely met** for application code. `rg` shows `sqlalchemy.text` / `from sqlalchemy import text` in **migrations** and **`core/database.py`** `check_connection()` (`SELECT 1`), which CLAUDE.md explicitly exempts. No `text()` matches surfaced under `tasks/`. |
| No `text()` from routers, services, or Celery tasks | **No violations found** in those layers via quick static search. |
| Never bypass repository layer | **Partial.** Persistence usually goes through repositories, but **routers sometimes import repositories** (e.g. audit on login). Some **services** are thin and **repositories open their own session** via `get_db_session()` (see below) instead of receiving a session from above — functionally valid, but not the strict “all DB access only through repository *and* single session per unit of work from the request” interpretation. |

### 1.3 Session handling: `get_db` vs `get_db_session`

- **`Depends(get_db)`** appears in **`routers/agent.py`** only (among routers searched): session is injected and passed into `AgentService(db)`.
- Many repositories (e.g. `repositories/jobs/job_run_repository.py`) call **`get_db_session()`** internally and close in `finally`. That pattern **decouples** the stack from FastAPI’s request-scoped session and can make **multi-step transactions** that span several repository calls harder to enforce as one atomic unit unless handled explicitly in one repository method.

**Verdict:** Aligned with the *spirit* of “data access in repositories,” with nuance on **transaction boundaries** and **testability** versus strict layered injection.

### 1.4 Security standard: 5xx responses

CLAUDE.md requires: for server errors, **do not** expose raw exception text in `HTTPException(detail=…)`; use **`core.safe_http_errors.raise_internal_server_error`** (client sees sanitized payload; correlate via logs).

**Finding:** There is **no** `safe_http_errors` module (or `raise_internal_server_error`) under `backend/core/` at the time of this analysis. Instead, **many** routers use `HTTPException(status_code=500, detail=str(e))` or `detail=str(exc)` (non-exhaustive examples: `routers/jobs/runs.py`, `routers/agent.py`, `routers/settings/git/repositories.py`, `routers/settings/git/operations.py`, `core/error_handlers.py`). Some 4xx paths also use `detail=str(e)`, which leaks validation or internal wording to clients depending on the exception type.

**Verdict:** **Standard not implemented** as written in CLAUDE.md; this is the largest **doc vs. code** gap for backend security UX.

### 1.5 Router guard scripts

CLAUDE.md lists scripts such as `python scripts/check_http_500_leaks.py` from `backend/`. Those paths were **not** present in the workspace snapshot used for this review (no `check_http_500_leaks.py` found under the repo root search). Either they live elsewhere, are optional, or the doc is ahead of the tree — worth reconciling so onboarding matches reality.

### 1.6 Nautobot / external API pattern

CLAUDE.md describes a **resolver/manager** layout under `services/nautobot/` for external APIs. That pattern is **documented for Nautobot**; NiFi and similar integrations follow an analogous **service submodule** style. **Consistent** with the “external client ≠ local repository” exception.

---

## 2. Python best practices

### 2.1 Strengths

- **Modern FastAPI usage:** dependencies for auth, Pydantic response models, modular routers.
- **Structured logging in many places:** e.g. `logger.error("…%s", e, exc_info=True)` and parameterized messages in reviewed services (e.g. `job_run_service.py`), which aligns with CLAUDE.md’s “avoid f-strings in logging” goal.
- **`from __future__ import annotations`** used in entrypoints and several modules — good for forward references and consistency when adopted widely.
- **Pytest:** `backend/pyproject.toml` configures markers, asyncio mode, and coverage — solid baseline for tests.

### 2.2 Gaps and risks

| Topic | Notes |
|-------|--------|
| **Static typing discipline** | Mixed strictness; `BaseRepository` uses a parameter name `id` (shadows builtin). No project-level **Mypy** (or Pyright) config was found in `backend/pyproject.toml`. |
| **Lint/format** | No **Ruff** / **Black** config in that `pyproject.toml` fragment — team consistency may rely on editor rules or CI elsewhere. |
| **Coverage scope** | `[tool.pytest.ini_options]` coverage includes `services`, `models`, `tasks`, `utils` but **omits** `routers`, `repositories`, and `core` from `--cov=…`, which under-measures the layers where auth and HTTP contracts live. |
| **Sync vs async endpoints** | Mix of `def` and `async def` routes is normal in FastAPI but worth monitoring for blocking I/O on the event loop where async is used. |
| **Exception handling** | Broad `except Exception` plus `detail=str(e)` on 500 responses is an **information disclosure** and **inconsistent API** concern (see section 1.4). |
| **Service construction** | Patterns like module-level `job_run_manager = _JobRunService()` in `routers/jobs/runs.py` are simple but **global mutable service instances** can complicate testing and lifecycle compared to factories or `Depends()`. |

### 2.3 Celery / asyncio

`start_celery.py` documents pitfalls around **`asyncio.run()`** in forked workers. Repository search did not show widespread `asyncio.run()` in application Python beyond comments — **good** relative to the documented Celery constraint.

---

## 3. Overall verdict

| Area | Alignment |
|------|-----------|
| **Layered architecture (persistence domains)** | **Strong** — repositories and services are the norm; routers are mostly thin. |
| **Models, migrations, PostgreSQL** | **Strong** — matches CLAUDE.md. |
| **Raw SQL / `text()` policy** | **Strong** in app code; migrations and health check exempt as allowed. |
| **Sanitized 5xx errors (`safe_http_errors`)** | **Not met** — module absent; many raw `str(e)` 500 responses remain. |
| **Strict “never touch repository from router”** | **Partial** — few but real exceptions (audit on login). |
| **Python ecosystem rigor (typing + linters in-repo)** | **Moderate** — tests exist; typing and Ruff/Mypy not evident in `backend/pyproject.toml`. |

---

## 4. Recommended next steps (priority)

1. **Implement** `core.safe_http_errors` (or equivalent) and **migrate** 500 paths (and sensitive 502/504) to sanitized responses; keep full trace in logs. This brings the codebase in line with CLAUDE.md and reduces accidental data leaks.
2. **Reconcile CLAUDE.md** with the actual location (or creation) of **router guard scripts** (`check_http_500_leaks`, etc.).
3. **Decide on session strategy:** either push `Session` from `Depends(get_db)` through services into repositories for request-scoped work, or document the **`get_db_session()` per call** pattern and its transaction rules explicitly.
4. **Expand coverage** to include `routers` and `repositories` (at least for auth and job execution paths).
5. Add **Ruff** + optional **Mypy/Pyright** in `backend/pyproject.toml` (or repo root) to enforce the standards already described in CLAUDE.md.

---

## 5. Method note

Findings combine: reading `CLAUDE.md`, `backend/main.py`, `backend/core/database.py`, `backend/repositories/base.py`, representative routers and services, `backend/core/models/__init__.py`, and repository-wide searches for `get_db`, `text(`, `HTTPException`, and `safe_http_errors`. This is a **static** review, not a full security audit or performance profile.
