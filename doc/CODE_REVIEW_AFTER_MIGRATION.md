# Code Review: Python Backend After Migration

**Date:** 2026-02-22
**Scope:** `/backend/` (177 Python files, ~41,000 lines of code)
**Migration:** From legacy Flask/SQLite stack to FastAPI/PostgreSQL/SQLAlchemy

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture & Code Organization](#2-architecture--code-organization)
3. [Security Analysis](#3-security-analysis)
4. [Database Patterns](#4-database-patterns)
5. [Logging & Observability](#5-logging--observability)
6. [Error Handling](#6-error-handling)
7. [API Design Consistency](#7-api-design-consistency)
8. [Code Smells & Anti-Patterns](#8-code-smells--anti-patterns)
9. [Celery & Background Jobs](#9-celery--background-jobs)
10. [Migration Completeness](#10-migration-completeness)
11. [Summary of Findings](#11-summary-of-findings)
12. [Prioritized Remediation Plan](#12-prioritized-remediation-plan)

---

## 1. Executive Summary

**Overall Score: 7.5/10**

The migration from Flask/SQLite to FastAPI/PostgreSQL/SQLAlchemy has been largely successful. The codebase follows a clean layered architecture (Router -> Service -> Repository -> Model) and demonstrates strong security fundamentals (JWT auth, RBAC, credential encryption, parameterized queries).

However, several issues need attention:

| Category | Status | Key Issue |
|----------|--------|-----------|
| **Architecture** | Good | Clean layering, some business logic leaks into routers |
| **Security** | Good (1 Critical) | SQLite remnant in `core/auth.py`, unauthenticated debug endpoint |
| **Database** | Good | Proper ORM usage, session detachment risk |
| **Logging** | Needs Work | 664 f-string logging violations, inconsistent levels |
| **Error Handling** | Mixed | Good decorator exists, 488 broad `except Exception` catches |
| **API Design** | Needs Work | Inconsistent response formats, missing status codes |
| **Migration** | 98% Complete | SQLite still used for API key lookup |

---

## 2. Architecture & Code Organization

### 2.1 Directory Structure (Good)

The backend follows a well-organized feature-based layout:

```
/backend/
├── core/                    # Infrastructure (auth, database, config, models)
├── models/                  # Pydantic request/response schemas
├── repositories/            # Data access layer (SQLAlchemy ORM)
│   ├── base.py              # Generic BaseRepository<T> with CRUD
│   ├── auth/                # User, RBAC repositories
│   ├── jobs/                # Job template, run, schedule repositories
│   ├── nifi/                # NiFi instance, registry flow repositories
│   └── settings/            # Credentials, template repositories
├── services/                # Business logic layer
│   ├── auth/                # User management, OIDC
│   ├── nifi/                # NiFi operations, deployment, certificates
│   ├── settings/            # Git, cache services
│   └── background_jobs/     # Cache demo jobs
├── routers/                 # FastAPI endpoints (thin HTTP layer)
│   ├── auth/                # Login, OIDC, profile
│   ├── jobs/                # Templates, schedules, runs, Celery API
│   ├── nifi/                # Instances, operations, deploy, flows
│   └── settings/            # Git, templates, cache, credentials, RBAC
├── tasks/                   # Celery background jobs
│   ├── execution/           # Task executors (backup, sync, scan, etc.)
│   └── scheduling/          # Job dispatcher, schedule checker
├── migrations/              # Database migration system
└── main.py                  # FastAPI app entry, router registration, startup
```

### 2.2 Layer Adherence

**Repository Layer** -- Correctly implemented. `BaseRepository[T]` in `repositories/base.py` provides generic typed CRUD. All repositories extend it and use SQLAlchemy ORM exclusively. No raw SQL injection risk in the repository layer.

**Service Layer** -- Mostly correct. Services encapsulate business logic and delegate data access to repositories. Exception: some services bypass repositories (see Section 8.2).

**Router Layer** -- Mixed. Most routers are thin HTTP handlers that delegate to services. However, several routers contain significant business logic that should be extracted (see Section 8.1).

### 2.3 Dependency Management

Imports use a "lazy import" pattern throughout, importing inside functions to avoid circular dependencies:

```python
# core/auth.py:20
def create_access_token(data: dict, ...):
    from config import settings  # Lazy import
```

This is a pragmatic solution, though it obscures dependencies. Consider a dependency injection container for cleaner management in the future.

---

## 3. Security Analysis

### 3.1 Authentication (Good)

| Mechanism | Implementation | Status |
|-----------|---------------|--------|
| JWT Tokens | `PyJWT` with HS256, proper expiration | Good |
| Password Hashing | `pbkdf2_sha256` via `passlib` | Good |
| Token Refresh | Accepts expired tokens (signature still verified) | Good |
| OIDC/SSO | Multi-provider support via `services/auth/oidc.py` | Good |

**`core/auth.py`** provides well-structured auth dependencies:
- `verify_token()` -- JWT validation
- `require_permission(resource, action)` -- RBAC permission check
- `require_role(role_name)` -- Role-based check
- `require_any_permission()` / `require_all_permissions()` -- Compound checks

### 3.2 CRITICAL: SQLite Remnant in API Key Auth

**File:** `core/auth.py:87-149`
**Severity:** Critical

The `verify_api_key()` function still uses SQLite3 directly, bypassing the PostgreSQL migration entirely:

```python
def verify_api_key(x_api_key: Optional[str] = None) -> dict:
    import sqlite3  # <-- STILL USING SQLITE
    db_path = os.path.join(config_settings.data_directory, "settings", "cockpit_settings.db")
    conn = sqlite3.connect(db_path)
    user_row = conn.execute(
        "SELECT username FROM user_profiles WHERE api_key = ? AND api_key IS NOT NULL",
        (x_api_key,),
    ).fetchone()
```

**Risks:**
- Data inconsistency between SQLite and PostgreSQL user stores
- SQLite file may become stale or missing after migration
- Breaks the "single database" architecture principle
- API key lookup uses a completely different auth path than JWT

**Recommendation:** Migrate API key storage to the PostgreSQL `users` table (add `api_key` column) or a dedicated `api_keys` table. Route through the repository layer.

### 3.3 CRITICAL: Unauthenticated Debug Endpoint

**File:** `routers/auth/oidc.py:385-386`
**Severity:** Critical

```python
@router.get("/debug")
async def get_oidc_debug_info():
    # NO AUTH DEPENDENCY -- exposed to anyone
```

This endpoint exposes:
- OIDC provider configuration details
- Discovery endpoint URLs
- Client IDs
- CA certificate paths and existence checks

**Recommendation:** Add `dependencies=[Depends(require_permission("settings.common", "write"))]` or `Depends(verify_admin_token)`.

### 3.4 Credential Encryption (Good)

**File:** `credentials_manager.py`

- Uses `cryptography.fernet` for symmetric encryption
- Derives key from `SECRET_KEY` using SHA256
- Passwords and SSH keys stored encrypted in database
- Proper key derivation, no hardcoded encryption keys

### 3.5 Permission Check Inconsistencies

Auth dependency usage varies across routers:

| Pattern | Example | Used In |
|---------|---------|---------|
| `Depends(require_permission("resource", "action"))` | `nifi/instances.py` | Most routers |
| `Depends(require_role("admin"))` | `settings/rbac.py` | Admin-only endpoints |
| `Depends(verify_token)` | `auth/profile.py` | Profile endpoints |
| `Depends(verify_admin_token)` | Some admin endpoints | Limited use |
| No auth dependency | `auth/oidc.py:385` | Debug endpoint (BUG) |

**Parameter naming is inconsistent:**
- `user: dict = Depends(...)` -- some routers
- `current_user: dict = Depends(...)` -- other routers
- `user_info: dict = Depends(...)` -- yet others

**Recommendation:** Standardize on one naming convention (suggest `current_user`) and document the auth dependency selection guide.

### 3.6 Admin Permission Check

**File:** `core/auth.py:73-84`

```python
def verify_admin_token(user_info: dict = Depends(verify_token)) -> dict:
    user_permissions = user_info["permissions"]
    if user_permissions != PERMISSIONS_ADMIN:  # Exact bitwise equality
        raise HTTPException(...)
```

Uses exact equality (`!=`) rather than bitwise AND (`&`). This means a user must have the **exact** admin permission bitmask -- adding any extra permission would cause a mismatch. This appears intentional for strict admin-only endpoints but is fragile.

### 3.7 Token Refresh Security

**File:** `routers/auth/auth.py:123-251`

The refresh endpoint accepts expired tokens (with signature verification). There is a commented-out grace window (1 hour) that is NOT enforced:

```python
# Optional: enforce a small grace window (uncomment if desired)
# if time() - exp > 3600:  # token expired more than 1 hour ago
#     raise HTTPException(...)
```

**Risk:** An old expired token can be refreshed indefinitely as long as the signature is valid and the user account is active. Consider enabling the grace window or implementing refresh tokens properly.

---

## 4. Database Patterns

### 4.1 Connection Pooling (Good)

**File:** `core/database.py:20-27`

```python
engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,   # Connection health checks
    pool_recycle=3600,     # Recycle after 1 hour
)
```

Properly configured for production use. `pool_pre_ping=True` ensures stale connections are detected before use.

### 4.2 Session Management (Risk)

**File:** `repositories/base.py`

Every repository method creates and closes its own session:

```python
def get_by_id(self, id: int) -> Optional[T]:
    db = get_db_session()
    try:
        return db.query(self.model).filter(self.model.id == id).first()
    finally:
        db.close()  # Session closed -> object is DETACHED
```

**Issue: Detached Object State**

Objects returned from repositories are **detached** from the SQLAlchemy session. Any subsequent access to lazy-loaded relationships will raise `DetachedInstanceError`.

The codebase mitigates this by converting to dicts immediately (e.g., `job_run_repository.py:_to_dict()`), but this is fragile. If a developer forgets to convert, they'll get runtime errors.

**Recommendation:** Consider:
1. Using `expire_on_commit=False` in `SessionLocal` configuration
2. Eager-loading relationships where needed (e.g., `options(joinedload(...))`)
3. A context-managed session pattern that keeps sessions open longer

### 4.3 SQL Injection Protection (Good)

No SQL injection vulnerabilities detected. All database queries use SQLAlchemy ORM parameterization.

**Exception:** `services/nifi/nifi_flow_service.py` uses raw SQL with `sqlalchemy.text()`, but this is justified because the `nifi_flows` table has a dynamically generated schema. The raw queries use named placeholders (`:id`, `:flow_id`) and column names are derived from trusted configuration, not user input.

### 4.4 N+1 Query Risks

**File:** `repositories/auth/rbac_repository.py`

RBAC permission queries use a two-query pattern instead of JOINs:

```python
# Query 1: Get role-permission mappings
role_perms = db.query(RolePermission).filter(...).all()
permission_ids = [rp.permission_id for rp in role_perms]

# Query 2: Get actual permissions
return db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
```

This runs on every authenticated request. **Recommendation:** Use `joinedload` or a single JOIN query.

### 4.5 Missing Database Constraints

| Table | Issue | Risk |
|-------|-------|------|
| `job_templates.job_type` | `String(50)` without CHECK constraint | Invalid values possible at DB level |
| `users.email` | Nullable in DB but sometimes required in Pydantic | Inconsistency |
| `users.password` | No min-length constraint at DB level | Weak passwords |
| `credentials` | Missing CHECK for type-specific required fields | `ssh_key` type could have no key |

Pydantic validation catches these at the API layer, but data could be inserted via direct DB access or migrations without validation.

### 4.6 Missing Indexes

- `job_templates`: Missing composite index on `(user_id, job_type)` -- would accelerate filtered user template queries

---

## 5. Logging & Observability

### 5.1 F-String Logging Violations

**Severity:** Medium (Performance + Standards)
**Count:** 664 occurrences across 62 files

The project standard (CLAUDE.md) prohibits f-strings in logging. However, nearly all log statements use f-strings:

```python
# WRONG (current) -- string is always formatted, even if log level is disabled
logger.info(f"Authenticated user {user['username']} (id={user['id']})")

# CORRECT -- lazy formatting, string only built if log level matches
logger.info("Authenticated user %s (id=%s)", user['username'], user['id'])
```

**Top offenders** (by count):
| File | f-string log count |
|------|-------------------|
| `tasks/execution/backup_executor.py` | 74 |
| `tasks/execution/command_executor.py` | 38 |
| `routers/jobs/celery_api.py` | 34 |
| `routers/settings/common.py` | 27 |
| `services/auth/oidc.py` | 26 |
| `services/settings/git/operations.py` | 23 |
| `routers/settings/templates.py` | 23 |

### 5.2 Missing Structured Context

Most log messages lack correlation IDs or request context. For a networked application with concurrent requests, this makes debugging difficult.

**Recommendation:** Add a middleware that injects a `request_id` into the logging context, and use structured logging (e.g., `python-json-logger`).

### 5.3 Sensitive Data in Logs

**File:** `routers/auth/auth.py:31`

```python
logger.info(f"Authenticated user {user['username']} (id={user['id']})")
```

While not logging passwords, user identification in plaintext could be a compliance concern depending on the deployment context. Consider using user IDs only in production logs.

---

## 6. Error Handling

### 6.1 Error Handler Decorators (Good Infrastructure)

**File:** `core/error_handlers.py`

Three well-designed decorators exist:
- `@handle_errors(operation)` -- General 500 error handler
- `@handle_not_found(operation, resource)` -- 404 handler
- `@handle_validation_errors(operation)` -- 400 handler

These provide:
- Consistent error logging with `exc_info=True`
- HTTPException pass-through
- Extra context in log records (operation, function, module)
- Support for both sync and async functions

### 6.2 Broad Exception Catching

**Count:** 488 instances of `except Exception` across 79 files

Many endpoints and services catch all exceptions generically:

```python
except Exception as e:
    logger.error(f"Error: {e}")
    raise HTTPException(status_code=500, detail="Internal error")
```

**Issues:**
- Masks specific error types (DB errors, network timeouts, validation errors)
- Makes debugging harder -- you can't distinguish a connection timeout from a logic error
- Some catches don't even log the exception (e.g., `core/auth.py:144`)

**Recommendation:** Replace broad catches with specific exception types. Use the existing `@handle_errors` decorator more widely to standardize behavior.

### 6.3 Inconsistent Error Response Format

Some endpoints return error dicts, others raise HTTPExceptions:

```python
# Pattern 1: HTTPException (correct)
raise HTTPException(status_code=400, detail="Invalid input")

# Pattern 2: Error dict (inconsistent, breaks FastAPI error handling)
return {"status": "error", "message": "Something failed"}  # Returns 200!
```

**File:** `routers/nifi/instances.py:159-163` returns an error dict instead of raising an exception, meaning the client receives a 200 status code for an error.

---

## 7. API Design Consistency

### 7.1 Response Envelope Formats

At least 4 different response formats exist:

```python
# Format 1: Direct data
return {"settings": settings_data}

# Format 2: Success flag
return {"success": True, "data": nautobot_settings}

# Format 3: Legacy compatibility
return {"success": True, "message": "...", "data": updated, "cache": updated}

# Format 4: Status + details
return {"status": "success", "message": "...", "details": result}
```

**Recommendation:** Define a standard response envelope and enforce it via a response model or middleware:

```python
class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
```

### 7.2 Missing HTTP Status Codes

Several POST creation endpoints return `200 OK` instead of `201 Created`:

| File | Endpoint | Returns |
|------|----------|---------|
| `routers/nifi/instances.py:73` | POST `/nifi/instances` | 200 (should be 201) |
| `routers/jobs/schedules.py:24` | POST `/job-schedules` | 200 (should be 201) |
| `routers/settings/rbac.py:58` | POST `/permissions` | 201 (correct) |

### 7.3 Duplicate Route Logic

The login (`routers/auth/auth.py:17-120`) and refresh (`routers/auth/auth.py:123-251`) endpoints contain duplicated RBAC role resolution logic:

```python
# Duplicated in both login() and refresh_token():
role_names = [r["name"] for r in user_with_roles.get("roles", [])]
primary_role = None
if "admin" in role_names:
    primary_role = "admin"
elif "operator" in role_names:
    primary_role = "operator"
# ... 15+ lines duplicated
```

**Recommendation:** Extract into a service method: `auth_service.build_login_response(user)`.

---

## 8. Code Smells & Anti-Patterns

### 8.1 Business Logic in Routers

Several routers contain logic that should be in the service layer:

**`routers/auth/auth.py` (login endpoint, lines 17-120):**
- User authentication
- RBAC role resolution and priority logic
- Primary role determination
- Audit logging
- Token creation with role data assembly

**`routers/auth/oidc.py` (callback endpoint, lines 180-338):**
- Token exchange
- ID token verification
- User provisioning
- RBAC role assignment
- Audit logging

**Recommendation:** Create `services/auth/login_service.py` to encapsulate authentication workflow.

### 8.2 Service Layer Bypass

Some services access data directly instead of through repositories:

| Service | Direct Access | Should Use |
|---------|--------------|------------|
| `services/auth/user_management.py` | `user_db` module directly | `UserRepository` |
| `services/settings/git/service.py` | Direct DB access patterns | Repository layer |

### 8.3 Manager Classes (Legacy)

Several `*_manager.py` files exist at the backend root level alongside the proper layered architecture:

```
backend/
├── credentials_manager.py
├── git_repositories_manager.py
├── job_run_manager.py
├── job_template_manager.py
├── jobs_manager.py
├── profile_manager.py
├── rbac_manager.py
├── settings_manager.py
├── template_manager.py
└── user_db_manager.py
```

These are legacy facades from the old architecture. While they work (they delegate to repositories/services), they add an unnecessary layer and create confusion about where logic should live.

**Recommendation:** Gradually migrate callers to use services/repositories directly. These managers should be deprecated.

### 8.4 Hardcoded Values

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `routers/auth/profile.py` | 131 | `42` (API key length) | `API_KEY_LENGTH` constant |
| `services/nifi/deploy_service.py` | 26 | `"="*60` (log formatting) | N/A (cosmetic) |
| `core/auth.py` | 26 | `timedelta(minutes=15)` | `DEFAULT_TOKEN_EXPIRY` constant |

### 8.5 Two `if __name__ == "__main__"` Blocks

**File:** `main.py:177-181` and `main.py:366-369`

The file has two separate `if __name__ == "__main__"` blocks. The first (line 177) runs before the `@app.on_event("startup")` definition, making it potentially miss startup initialization. The second (line 369) is the correct one.

### 8.6 Deprecated FastAPI Events

**File:** `main.py:185, 359`

```python
@app.on_event("startup")   # Deprecated in FastAPI
@app.on_event("shutdown")  # Deprecated in FastAPI
```

FastAPI has deprecated `on_event` in favor of `lifespan` context managers. This works today but should be migrated.

---

## 9. Celery & Background Jobs

### 9.1 Configuration (Good)

**File:** `celery_app.py`

- Redis broker and result backend properly configured
- Task serialization: JSON (safe for distributed systems)
- `task_acks_late=True` (reliable delivery -- task re-queued if worker crashes)
- `broker_connection_retry_on_startup=True`
- Smart queue configuration avoids DB access at import time (prevents macOS fork/SIGSEGV)

### 9.2 Task Implementation (Good)

**File:** `tasks/job_tasks.py`

- Proper `@celery_app.task(bind=True)` usage
- JobRun records created to track execution
- Structured result dicts returned
- Good error handling with try/except

### 9.3 Task Execution Pattern

Task executors in `tasks/execution/` follow a consistent pattern:
- Accept configuration dict
- Log operations with context
- Return structured results
- Handle errors gracefully

---

## 10. Migration Completeness

### 10.1 SQLite Remnants

| File | Usage | Status |
|------|-------|--------|
| `core/auth.py:87-149` | API key lookup via SQLite | **NEEDS MIGRATION** |
| `set_admin_password.py:20` | Admin password reset script | Acceptable (one-time admin tool) |

### 10.2 What Was Done Well

- All primary data access migrated to PostgreSQL via SQLAlchemy ORM
- Proper connection pooling and health checks
- Repository pattern for data access abstraction
- Pydantic models for request/response validation
- RBAC system fully implemented in PostgreSQL
- Credential encryption migrated properly
- Celery task system properly configured

### 10.3 Remaining Technical Debt

1. **SQLite in API key auth** -- Critical, must migrate
2. **Root-level manager files** -- Should be consolidated into services
3. **F-string logging** -- 664 violations to fix
4. **Broad exception catches** -- 488 instances to narrow
5. **Deprecated FastAPI events** -- Migrate to lifespan

---

## 11. Summary of Findings

### By Severity

#### Critical (Fix Immediately)

| # | Issue | File | Line |
|---|-------|------|------|
| C1 | SQLite3 used for API key authentication | `core/auth.py` | 87-149 |
| C2 | `/auth/oidc/debug` endpoint has NO authentication | `routers/auth/oidc.py` | 385 |

#### High (Fix Soon)

| # | Issue | File |
|---|-------|------|
| H1 | Detached SQLAlchemy objects from closed sessions | `repositories/base.py` |
| H2 | Token refresh has no expiry grace window | `routers/auth/auth.py:148-154` |
| H3 | Error response returns 200 for errors | `routers/nifi/instances.py:159-163` |
| H4 | Business logic in auth routers | `routers/auth/auth.py`, `routers/auth/oidc.py` |
| H5 | N+1 queries in RBAC permission checks | `repositories/auth/rbac_repository.py` |

#### Medium (Plan to Fix)

| # | Issue | Count/File |
|---|-------|------------|
| M1 | F-string logging violations | 664 occurrences / 62 files |
| M2 | Broad `except Exception` catches | 488 occurrences / 79 files |
| M3 | Inconsistent API response formats | Multiple routers |
| M4 | Inconsistent auth parameter naming | Multiple routers |
| M5 | Missing `201 Created` status codes | Multiple POST endpoints |
| M6 | Duplicated role resolution logic | `routers/auth/auth.py` |
| M7 | Missing database CHECK constraints | `core/models.py` |
| M8 | Legacy manager files at root level | 10 files |

#### Low (Nice to Have)

| # | Issue | File |
|---|-------|------|
| L1 | Deprecated `@app.on_event` usage | `main.py:185, 359` |
| L2 | Duplicate `if __name__ == "__main__"` | `main.py:177, 366` |
| L3 | Hardcoded magic numbers | Various files |
| L4 | Missing composite database indexes | `core/models.py` |

### Strengths

- Clean layered architecture (Router -> Service -> Repository -> Model)
- Strong security fundamentals (JWT, RBAC, password hashing, credential encryption)
- No SQL injection vulnerabilities
- Good type hint coverage (~80%+)
- Well-designed error handler decorators (`core/error_handlers.py`)
- Comprehensive audit logging
- Proper Celery configuration with reliability settings
- PostgreSQL connection pooling and health checks
- Feature-based code organization

---

## 12. Prioritized Remediation Plan

### Phase 1: Security Fixes (Week 1)

1. **Migrate API key auth to PostgreSQL** (`core/auth.py`)
   - Add `api_key` column to `users` table or create `api_keys` table
   - Create `ApiKeyRepository` extending `BaseRepository`
   - Remove SQLite3 imports and file access

2. **Secure OIDC debug endpoint** (`routers/auth/oidc.py:385`)
   - Add `dependencies=[Depends(require_role("admin"))]`

3. **Enable token refresh grace window** (`routers/auth/auth.py`)
   - Uncomment and configure the 1-hour grace window
   - Consider implementing proper refresh tokens

### Phase 2: Stability Fixes (Week 2-3)

4. **Fix error response consistency**
   - Replace dict error returns with `HTTPException` raises
   - Define standard `ApiResponse` model
   - Add `status_code=201` to all POST creation endpoints

5. **Extract business logic from routers**
   - Create `services/auth/login_service.py`
   - Move RBAC role resolution, token creation, audit logging

6. **Fix session detachment risk**
   - Add `expire_on_commit=False` to `SessionLocal`
   - Add eager loading for frequently accessed relationships

7. **Optimize RBAC queries**
   - Replace two-query pattern with single JOIN in `rbac_repository.py`

### Phase 3: Code Quality (Week 4+)

8. **Fix f-string logging** (664 occurrences)
   - Automated find-and-replace with regex
   - `logger.info(f"msg {var}")` -> `logger.info("msg %s", var)`

9. **Narrow exception catches** (488 occurrences)
   - Use `@handle_errors` decorator where possible
   - Replace `except Exception` with specific types

10. **Standardize auth parameter naming**
    - Adopt `current_user` consistently across all routers

11. **Deprecate root-level managers**
    - Migrate callers to use services/repositories directly
    - Add deprecation warnings to manager functions

12. **Migrate to FastAPI lifespan**
    - Replace `@app.on_event("startup/shutdown")` with `lifespan` context manager
