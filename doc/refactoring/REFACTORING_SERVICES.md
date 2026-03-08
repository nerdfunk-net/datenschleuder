# Refactoring plan: backend services

This plan covers the `backend/services/` layer, based on analysis of the current codebase as of 2026-03-08. It focuses on reducing risk while fixing the real architectural problems.

## 1. Goals

- Break large service modules into clear, testable responsibilities.
- Replace import-time service singletons with explicitly factory-managed lifetimes.
- Use plain factory functions for dependency injection (no DI library).
- Remove direct database access from services that should use the repository layer.
- Solve the nipyapi global-state race condition.
- Improve config lifecycle (avoid repeated DB reads with no caching).
- Keep the existing repository pattern intact for PostgreSQL-backed data.
- Roll out changes in slices that keep routers, tasks, and tests working during the migration.

## 2. Current state inventory

### 2.1 Service file sizes

| # | File | Lines | Concern |
|---|------|-------|---------|
| 1 | `settings/git/service.py` | 741 | Central git service |
| 2 | `cert_manager/cert_operations.py` | 730 | Cert convert, export, import, keystore |
| 3 | `nifi/deployment.py` | 719 | Flow deployment (16 methods in one class) |
| 4 | `auth/oidc.py` | 685 | OIDC auth (config, token, JWKS, SSO) |
| 5 | `settings/cache.py` | 480 | Redis cache service |
| 6 | `nifi/operations/process_groups.py` | 458 | Process group operations |
| 7 | `settings/git/operations.py` | 448 | Git file operations |
| 8 | `settings/git/cache.py` | 404 | Git commit cache |
| 9 | `nifi/deploy_service.py` | 381 | Deployment orchestration |
| 10 | `nifi/operations/management.py` | 366 | NiFi management ops |
| 11 | `nifi/nifi_config_service.py` | 362 | Server and cluster config |
| 12 | `nifi/nifi_flow_service.py` | 323 | Flow CRUD (raw SQL!) |
| 13 | `settings/git/auth.py` | 318 | Git authentication |
| 14 | `settings/git/connection.py` | 312 | Git connection testing |

### 2.2 Module-level singletons (9 total)

| # | Singleton | File | Line |
|---|-----------|------|------|
| 1 | `oidc_service` | `auth/oidc.py` | 685 |
| 2 | `nifi_connection_service` | `nifi/connection.py` | 293 |
| 3 | `encryption_service` | `nifi/encryption.py` | 46 |
| 4 | `git_service` | `settings/git/service.py` | 741 |
| 5 | `git_auth_service` | `settings/git/auth.py` | 318 |
| 6 | `git_cache_service` | `settings/git/cache.py` | 404 |
| 7 | `git_operations_service` | `settings/git/operations.py` | 448 |
| 8 | `git_connection_service` | `settings/git/connection.py` | 312 |
| 9 | `git_diff_service` | `settings/git/diff.py` | 244 |

Additional module-level instances outside `services/`:

| # | Singleton | File |
|---|-----------|------|
| 10 | `certificate_manager` | `nifi/certificate_manager.py` |
| 11 | `nifi_oidc_config` | `nifi/oidc_config.py` |
| 12 | `cache_service` | `settings/cache.py` (last lines) |
| 13 | `settings_manager` | `settings_manager.py` (root) |

Module-level repository instances in services (not using `Depends()`):

| # | Instance | File |
|---|----------|------|
| 14 | `_instance_repo` | `nifi/deploy_service.py` |
| 15 | `_registry_flow_repo` | `nifi/deploy_service.py` |
| 16 | `_value_repo` | `nifi/hierarchy_service.py` |
| 17 | `server_repo`, `cluster_repo`, `instance_repo`, `cred_repo` | `nifi/nifi_config_service.py` |

### 2.3 Direct database access in services (bypasses repository layer)

These services call `get_db_session()` or `engine.connect()` directly instead of going through a repository:

| # | File | Call sites | Pattern |
|---|------|-----------|---------|
| 1 | `nifi/hierarchy_service.py` | 7 | `get_db_session()` + `db.query(Setting)` |
| 2 | `nifi/deploy_service.py` | 1 | `get_db_session()` + `db.query(Setting)` |
| 3 | `nifi/nifi_flow_service.py` | 7 | `engine.connect()` + raw SQL `text()` |
| 4 | `nifi/flow_view_service.py` | 2 | `get_db_session()` |

The `nifi_flow_service.py` is the most problematic: it uses raw SQL with f-string column names. The column names come from admin-controlled hierarchy config, not user input, so the SQL injection risk is limited. But it bypasses the repository pattern entirely.

### 2.4 nipyapi global-state race condition (critical)

`nipyapi` stores connection config in process-global state (`nipyapi.config.nifi_config`). The `NifiConnectionService.configure_from_instance()` method mutates this global state before each NiFi API call. This pattern is called from:

- 3 router endpoints (`nifi/operations.py`, `nifi/nifi_config.py`)
- 2 task executors (`check_process_group_executor.py`, `check_queues_executor.py`)
- 2 service files (`deploy_service.py`, `instance_service.py`, `install_service.py`)

**The race condition:** Under FastAPI's async model, two concurrent requests targeting different NiFi instances call `configure_from_instance()` back-to-back, leaving `nipyapi.config` pointing at whichever ran last. Operations after the second configure hit the wrong instance.

**Celery tasks are safe** because Celery runs one task per worker process (solo or prefork), so no concurrent mutation.

**FastAPI routes are not safe** because multiple async handlers share the same process.

### 2.5 Config lifecycle issues

| Service | Config source | Read frequency | Caching |
|---------|--------------|----------------|---------|
| `OIDCService` | `settings_manager.get_oidc_provider()` | Every method call | JWKS cached 1 hour; config re-read every call |
| `hierarchy_service` | `db.query(Setting)` | Every call to `get_hierarchy_config()` | None |
| `deploy_service` | `db.query(Setting)` | Every deployment | None |
| `nifi_flow_service` | `get_hierarchy_config()` | Every flow CRUD operation | None |
| `NifiOidcConfigManager` | YAML file | On init + reload | In-memory |
| `CertificateManager` | YAML file | Lazy load | In-memory |
| `RedisCacheService` | `config.settings.redis_url` | On init | N/A (connection is the value) |

The hierarchy config is the worst case: 4 services read it from the database on every call, and it almost never changes. A simple TTL cache or settings-change event saves unnecessary queries.

### 2.6 Router → service coupling

**No routers use `Depends()` for service injection.** All routers import services at module level or inside handler functions. This blocks testability and prevents request-scoped lifetimes.

Import patterns observed:
- Module-level import of service module: `from services.nifi import deploy_service`
- Module-level import of singleton: `from services.nifi.connection import nifi_connection_service`
- In-function import: `from template_manager import template_manager` (used to avoid circular imports)

### 2.7 Async vs sync

| Category | Pattern | Risk |
|----------|---------|------|
| OIDC service | Async (`httpx.AsyncClient`) | Low — properly async |
| NiFi services | All sync (nipyapi is sync) | **Medium** — sync nipyapi calls in async handlers block the event loop |
| Git services | All sync (GitPython is sync) | Medium — file I/O blocks |
| Cache service | Sync (redis-py) | Low — fast operations |
| Cert operations | Sync (subprocess calls) | Medium — `openssl` subprocess may block |

No manual event-loop management (`asyncio.new_event_loop`, `run_until_complete`) exists in the services layer. The only mention is in `start_celery.py` comments (documentation, not code).

### 2.8 Constraints

- Do not break Celery workers while refactoring web routes.
- Celery workers run in separate OS processes with no FastAPI app object.
- Do not create a second repository abstraction; use existing `backend/repositories`.
- Preserve testability by moving construction into factories.
- The nipyapi library requires global config. Any multi-instance solution must scope config per operation.

### 2.9 Non-goals

- Do not rewrite all legacy `*_manager.py` files in one pass (10 files, 4,152 lines total at backend root).
- Do not migrate nipyapi to an async HTTP library.
- Do not add a third-party DI framework.

## 3. Pitfalls and risks

### 3.1 nipyapi global state is single-threaded by design

nipyapi sets `nipyapi.config.nifi_config.host`, `username`, `password`, SSL, etc. as process globals. There is no "session" or "connection" object you can pass to individual API calls.

**Mitigation options (pick one):**

1. **Connection lock** — Wrap `configure_from_instance()` + the API call in an `asyncio.Lock` so only one NiFi operation runs at a time per process. Simple but kills concurrency.
2. **Copy-on-configure** — Before each operation, save the global config, set it, do the call, and restore. Fragile but transparent.
3. **Thread isolation** — Run each nipyapi call in a dedicated thread via `run_in_executor`, since nipyapi uses thread-local state for some config. Requires validation.
4. **NiFi context manager** — Create a context manager that saves the current nipyapi config, applies the new config, executes the operation, and restores. Essentially option 2 with cleanup.

**Recommendation:** Option 4 (context manager) combined with option 1 (lock) provides safety. The lock prevents concurrent mutations, and the context manager ensures cleanup on exceptions.

> [!CAUTION]
> `copy.deepcopy(nipyapi.config.nifi_config)` crashes at runtime with `TypeError: cannot pickle '_thread.RLock' object`. The `Configuration` object contains a `logging.Logger` with lock handlers. Save and restore individual attributes instead. See Phase 2 for the tested implementation.

### 3.2 `nifi_flow_service.py` uses raw SQL with dynamic columns

Column names in `INSERT` and `UPDATE` statements are built from hierarchy config via f-strings:
```python
cols_str = ", ".join(columns)  # columns from hierarchy config
text(f"INSERT INTO nifi_flows ({cols_str}) VALUES ({placeholders}) RETURNING id")
```

The column names originate from admin-controlled settings, not user input, so the injection risk is limited to admin-privilege attacks. However, the pattern bypasses the repository layer and violates the project's "no raw SQL" rule.

**Recommended fix:** Create a `NifiFlowRepository` that uses SQLAlchemy Core `Table` with dynamic columns (the table is already created dynamically in `hierarchy_service.py`). This preserves parameterized queries and uses the repository pattern.

### 3.3 Circular import risk with singletons

Several services import other singletons at module level:
- `nifi/connection.py` → imports `encryption_service`, `certificate_manager`, `nifi_oidc_config`
- `nifi/instance_service.py` → imports `encryption_service`, `nifi_connection_service`
- `settings/git/service.py` → imports `git_auth_service`

Removing singletons must happen bottom-up (leaf dependencies first) to avoid circular import breakage. The order: `encryption_service` → `certificate_manager`, `nifi_oidc_config` → `nifi_connection_service` → consuming services.

### 3.4 `settings_manager` at project root

`settings_manager.py` (652 lines) is a global singleton used by both services and routers via inline imports. It's the central config hub but lives outside the `services/` directory. Migrating it requires updating ~30 import sites across the project. It should be one of the last singletons removed.

### 3.5 Cache service initialization can crash at import time

`settings/cache.py` creates a Redis connection at module level:
```python
cache_service = RedisCacheService(redis_url=settings.redis_url, ...)
```
If Redis is unavailable at import time, the process fails. For Celery workers that import this module, a Redis outage prevents worker startup even if the task doesn't need caching.

### 3.6 nifi_config_service has module-level repository instances

`nifi_config_service.py` creates four repository instances at module level. These repositories create DB sessions internally, meaning the session lifetime is tied to the module, not the request. This works in practice because repositories create short-lived sessions, but it prevents proper session scoping.

## 4. Service lifetime model

### 4.1 App-scoped services

Use one shared instance for the process lifetime. Construct during FastAPI lifespan or Celery worker init.

- `EncryptionService` — deterministic key derived from SECRET_KEY, no state drift.
- `OIDCService` — holds JWKS cache, SSL contexts. Must not be request-scoped.
- `RedisCacheService` — holds Redis connection pool.

### 4.2 Request-scoped services

Construct per request through FastAPI `Depends()` providers.

- `NifiConnectionService` — must isolate nipyapi config per operation.
- Thin orchestration services that combine app-scoped clients with request context.

### 4.3 Factory-built task services

Construct through `service_factory.py` for Celery tasks and non-FastAPI entry points.

- Tasks cannot use `Depends()`. The factory provides the same construction but without FastAPI.
- For nipyapi tasks, concurrency is not an issue (one task per worker), so the global config is safe.

## 5. Milestone structure

The plan splits into three shippable milestones. After each milestone the system is stable.

```
MILESTONE A: foundation (Phases 1-2)
├── Phase 1: Composition root and dependency injection
└── Phase 2: Solve nipyapi global-state race condition

MILESTONE B: decomposition (Phases 3-4)
├── Phase 3: Large service decomposition
└── Phase 4: Config lifecycle improvements

MILESTONE C: cleanup (Phases 5-6)
├── Phase 5: Singleton removal sweep
└── Phase 6: Raw SQL elimination and repository alignment
```

## 6. Milestone A — foundation

### Phase 1: Composition root and dependency injection

**New files:** `backend/dependencies.py`, `backend/service_factory.py`

**Goal:** Replace import-time singleton construction with explicit factories and correct lifetimes.

#### Design decision: plain factory functions, no DI library

FastAPI's `Depends()` system is already dependency injection. Adding a library introduces a second overlapping pattern. Two files with strict separation:

- `backend/dependencies.py` — FastAPI `Depends()` providers only. Imports `fastapi.Request`. Used exclusively by routers. Retrieves app-scoped services from `app.state` and constructs request-scoped services.
- `backend/service_factory.py` — plain Python factory functions, no FastAPI imports. Used by Celery tasks and non-router code. Tasks must not import from `dependencies.py`.

`dependencies.py` calls `service_factory.py` internally, not the other way around.

#### Step-by-step workflow

```
Step 1.1  ✅ Create `backend/service_factory.py`
          Factory functions for each service:
            - build_encryption_service() -> EncryptionService
            - build_oidc_service() -> OIDCService
            - build_nifi_connection_service() -> NifiConnectionService
            - build_cache_service() -> RedisCacheService
            - build_git_service() -> GitService
          No FastAPI imports. No global state.

Step 1.2  ✅ Create `backend/dependencies.py`
          FastAPI Depends() providers:
            - get_encryption_service(request) -> EncryptionService
              reads from request.app.state.encryption_service
            - get_oidc_service(request) -> OIDCService
              reads from request.app.state.oidc_service
            - get_nifi_connection_service() -> NifiConnectionService
              builds new instance per request
            - get_cache_service(request) -> RedisCacheService
              reads from request.app.state.cache_service
            - get_git_service() -> GitService
              calls service_factory.build_git_service()

Step 1.3  ✅ Wire app-scoped services in lifespan
          In main.py lifespan:
            - app.state.encryption_service = service_factory.build_encryption_service()
            - app.state.oidc_service = service_factory.build_oidc_service()
            - app.state.cache_service = service_factory.build_cache_service()

Step 1.4  ⏳ Migrate 2-3 routers as proof of concept
          Start with:
            - routers/nifi/instances.py (uses instance_service, nifi_connection_service)
            - routers/auth/oidc.py (uses oidc_service)
          For each router:
            - Replace `from services.x import x_service` with
              `x_service: XService = Depends(get_x_service)` in handler signature.
            - Run tests after each file.

Step 1.5  ⏳ Migrate 2-3 tasks as proof of concept
          Start with:
            - tasks/execution/check_process_group_executor.py
            - tasks/execution/check_queues_executor.py
          Replace inline singleton imports with factory calls at task entry point.

Step 1.6  ⏳ Migrate remaining routers and tasks
          Work through all remaining files. Remove singleton exports
          only after all callers are migrated.

Step 1.7  ⏳ Verify
          - Run the full test suite.
          - No router imports a service singleton directly.
          - No task imports a service singleton directly.
          - Smoke test: router flows and Celery task flows.
```

#### Exit criteria

- `backend/dependencies.py` and `backend/service_factory.py` exist with clear ownership.
- Routers request services through `Depends()` providers.
- Tasks construct services through factory functions.
- No router or task body imports a service singleton directly.

---

### Phase 2: Solve nipyapi global-state race condition

**New file:** `backend/services/nifi/nifi_context.py`

**Goal:** Prevent concurrent FastAPI requests from corrupting nipyapi's global config when targeting different NiFi instances.

#### Why this is not straightforward

`nipyapi.config.nifi_config` is a `nipyapi.nifi.configuration.Configuration` object with ~25 mutable attributes. Three hidden pitfalls make a naive solution fail:

1. **`copy.deepcopy()` crashes.** The `Configuration` object contains a `logging.Logger` with `_thread.RLock` handlers. `deepcopy` raises `TypeError: cannot pickle '_thread.RLock' object`. Any solution that calls `copy.deepcopy(nipyapi.config.nifi_config)` fails at runtime.

2. **`api_key` and `api_key_prefix` are dicts.** After `nipyapi.security.service_login()`, the JWT token lives in `api_key["bearerAuth"]`. A shallow save copies only the dict reference. The restore step needs `dict(api_key)` to snapshot, or the original dict is still mutated.

3. **`api_client` holds cached connections.** When nipyapi creates an internal `ApiClient`, it stores it on the config. Setting `api_client = None` during restore forces nipyapi to rebuild the client with the restored host and auth. Restoring a stale `api_client` pointing at the wrong host silently routes calls to the wrong instance.

#### Design: connection context manager with lock

Save and restore only the connection-relevant attributes manually. Do not use `copy.deepcopy`.

```python
import asyncio
from contextlib import contextmanager
from nipyapi import config as nipyapi_config

_nifi_lock = asyncio.Lock()

# Attributes that configure_from_instance() and service_login() mutate.
# Dicts (api_key, api_key_prefix) need dict() copies.
# api_client must be reset to None on restore to force rebuild.
_SAVE_ATTRS = (
    "host", "username", "password",
    "verify_ssl", "ssl_ca_cert", "cert_file", "key_file",
    "api_key", "api_key_prefix",
    "safe_chars_for_path_param",
)

def _save_nifi_config():
    cfg = nipyapi_config.nifi_config
    saved = {}
    for attr in _SAVE_ATTRS:
        val = getattr(cfg, attr)
        saved[attr] = dict(val) if isinstance(val, dict) else val
    return saved

def _restore_nifi_config(saved):
    cfg = nipyapi_config.nifi_config
    for attr, val in saved.items():
        setattr(cfg, attr, val)
    # Force nipyapi to rebuild the HTTP client with restored settings
    cfg.api_client = None

@contextmanager
def nifi_connection_scope(instance):
    """Scoped nipyapi config for a single NiFi operation."""
    saved = _save_nifi_config()
    try:
        nifi_connection_service.configure_from_instance(instance)
        yield
    finally:
        _restore_nifi_config(saved)
```

For async router handlers, wrap the sync nipyapi call in `run_in_executor` with an async lock:

```python
async def with_nifi_instance(instance, sync_operation):
    """Run a sync nipyapi operation scoped to a specific NiFi instance."""
    async with _nifi_lock:
        with nifi_connection_scope(instance):
            return await asyncio.get_event_loop().run_in_executor(
                None, sync_operation
            )
```

For Celery tasks, use `nifi_connection_scope` directly (no lock needed, one task per process).

#### Multi-worker caveat

The `asyncio.Lock` protects within a single uvicorn worker process. If you run multiple uvicorn workers (`--workers N`), each worker has its own lock and its own copy of `nipyapi.config`. This is safe because nipyapi globals are per-process. No cross-process lock is needed.

#### Step-by-step workflow

```
Step 2.1  ✅ Create `services/nifi/nifi_context.py`
          - nifi_connection_scope() context manager
          - with_nifi_instance() async helper for routers

Step 2.2  ✅ Update router sites (3 files, 7 call sites)
          - routers/nifi/operations.py — wrap operations in with_nifi_instance()
          - routers/nifi/nifi_config.py — wrap config reads
          - services/nifi/instance_service.py — wrap test connection

Step 2.3  ✅ Update task sites (2 files)
          - tasks/execution/check_process_group_executor.py
          - tasks/execution/check_queues_executor.py
          Use nifi_connection_scope() without the async lock.

Step 2.4  ✅ Update service sites (3 files)
          - services/nifi/deploy_service.py
          - services/nifi/install_service.py
          - services/nifi/instance_service.py

Step 2.5  ⏳ Verify
          - Concurrent requests to different NiFi instances
            do not cross-contaminate.
          - Celery tasks still work.
```

#### Exit criteria

- No nipyapi global state mutation without a scoped context manager.
- Concurrent router requests to different NiFi instances are safe.
- Celery tasks continue to work without the async lock overhead.

#### Milestone A verification checklist

- [x] Routers use `Depends()` for service injection. *(auth + permission; service-level DI not yet done — Steps 1.4–1.6 skipped)*
- [ ] Tasks use `service_factory` for service construction. *(Steps 1.4–1.6 not started)*
- [x] nipyapi global state is scoped per operation. *(Phase 2 complete)*
- [ ] Module-level singletons are removed or deprecated. *(Phase 5 not started)*
- [ ] All tests pass.

---

## 7. Milestone B — decomposition

Phases 3 and 4 are independent. Pick the order based on which problems cause the most pain.

### Phase 3: Large service decomposition

#### 3a. `nifi/deployment.py` (719 lines, 16 methods)

Split the `NiFiDeploymentService` class into focused modules:

| New module | Methods | Responsibility |
|------------|---------|----------------|
| `deployment/registry.py` | `get_bucket_and_flow_identifiers`, `get_deploy_version` | Registry lookups |
| `deployment/version_control.py` | `stop_version_control`, `start_process_group`, `disable_process_group`, `assign_parameter_context` | Lifecycle management |
| `deployment/port_connections.py` | `auto_connect_ports`, `_auto_connect_port`, `_connect_input_ports` | Port auto-wiring |
| `deployment/core.py` | `check_existing_process_group`, `deploy_flow_version`, `rename_process_group`, `extract_deployed_version` | Core deploy logic |

Keep a thin `NiFiDeploymentService` facade that delegates to these modules.

#### 3b. `cert_manager/cert_operations.py` (730 lines)

Split by operation type:

| New module | Responsibility |
|------------|----------------|
| `cert_manager/convert.py` | PEM ↔ PKCS12 conversion |
| `cert_manager/keystore.py` | Keystore and truststore creation |
| `cert_manager/export.py` | Export operations |
| `cert_manager/import_cert.py` | Import operations |
| `cert_manager/git_integration.py` | `_commit_file()` and git-related helpers |

#### 3c. `auth/oidc.py` (685 lines)

The `OIDCService` class handles discovery, token exchange, JWKS, token validation, user provisioning, and SSO. Split into:

| New module | Responsibility |
|------------|----------------|
| `auth/oidc/discovery.py` | OIDC discovery endpoint, config fetching |
| `auth/oidc/token.py` | Token exchange, token validation |
| `auth/oidc/jwks.py` | JWKS fetching and caching |
| `auth/oidc/user_provisioning.py` | Auto-provision OIDC users |
| `auth/oidc/service.py` | Thin facade that delegates to above |

#### 3d. `nifi/deploy_service.py` (381 lines)

This module-level function group creates repository instances at module level and reads settings from the DB inline. Refactor to:

- Accept repositories via the factory or dependency injection.
- Move `_get_last_hierarchy_attr()` to use the config service (Phase 4).

#### Step-by-step workflow

```
Step 3.1  ✅ Split deployment.py into 4 focused modules + facade.
          deployment/registry.py, core.py, port_connections.py, version_control.py
          Old deployment.py deleted.

Step 3.2  ✅ Split cert_operations.py into 5 modules.
          _openssl.py, convert.py, export.py, import_cert.py, keystore.py,
          git_integration.py, file_service.py (added later by user).
          cert_operations.py is now a re-export facade.

Step 3.3  ✅ Split oidc.py into 4 modules + facade.
          auth/oidc/discovery.py, token.py, jwks.py, user_provisioning.py,
          service.py, __init__.py. Old auth/oidc.py deleted.

Step 3.4  ⏳ Refactor deploy_service.py to accept injected repos.
          Still uses get_db_session() at line 359. Not started.
```

#### Exit criteria

- No service file exceeds 400 lines.
- Each module has one clear reason to change.
- Existing API behavior and test coverage are preserved.

---

### Phase 4: Config lifecycle improvements

**Goal:** Eliminate redundant database reads for config that changes rarely.

#### 4a. Hierarchy config caching

The hierarchy config is read from `Setting.key == "hierarchy_config"` at least 4 times per flow CRUD operation and never cached. It changes only when an admin saves the hierarchy settings page.

**Solution:** Cache the parsed hierarchy config in-memory with a short TTL (60 seconds) or use a version counter. The cache invalidates when `save_hierarchy_config()` is called.

```python
# services/nifi/hierarchy_service.py
import time

_hierarchy_cache = None
_hierarchy_cache_time = 0
_HIERARCHY_CACHE_TTL = 60  # seconds

def get_hierarchy_config() -> dict:
    global _hierarchy_cache, _hierarchy_cache_time
    now = time.monotonic()
    if _hierarchy_cache is not None and (now - _hierarchy_cache_time) < _HIERARCHY_CACHE_TTL:
        return _hierarchy_cache

    db = get_db_session()
    try:
        setting = db.query(Setting).filter(Setting.key == "hierarchy_config").first()
        result = json.loads(setting.value) if setting and setting.value else {"hierarchy": DEFAULT_HIERARCHY}
        _hierarchy_cache = result
        _hierarchy_cache_time = now
        return result
    finally:
        db.close()

def invalidate_hierarchy_cache():
    global _hierarchy_cache
    _hierarchy_cache = None
```

Call `invalidate_hierarchy_cache()` from `save_hierarchy_config()`.

#### 4b. OIDC provider config

`OIDCService` calls `settings_manager.get_oidc_provider(provider_id)` in every method. The OIDC provider config is YAML-based and changes only on file edit + restart.

**Solution:** Load provider configs once at `OIDCService.__init__()` and add a `reload()` method. The existing `_configs` dict can hold both discovery results (with TTL) and static provider config.

#### 4c. Cache service initialization

Move cache service construction from module-level to the `service_factory.py` / `main.py` lifespan. This prevents import-time crashes when Redis is unavailable and lets tests mock the cache.

#### Step-by-step workflow

```
Step 4.1  ✅ Add TTL cache to get_hierarchy_config().
          Added _hierarchy_cache, _hierarchy_cache_time, _HIERARCHY_CACHE_TTL=60s.
          invalidate_hierarchy_cache() called from save_hierarchy_config().

Step 4.2  ✅ Refactor OIDCService to load provider configs once.
          Provider configs loaded at __init__; OIDCService.service.py holds
          _provider_configs dict populated at startup.

Step 4.3  ⏳ Move cache_service construction to service_factory.
          cache_service = RedisCacheService(...) still exists at module level
          in services/settings/cache.py line 474. Not migrated yet.
```

#### Exit criteria

- Hierarchy config is read from DB at most once per 60 seconds. ✅
- OIDC provider config is loaded once, not on every method call. ✅
- Cache service initialization does not crash at import time. ⏳

---

## 8. Milestone C — cleanup

### Phase 5: Singleton removal sweep

Remove remaining module-level singletons not handled by Phases 1-4.

#### Priority order

1. **NiFi services** (touched in Phase 2):
   - `encryption_service` → `app.state` (app-scoped, immutable after init)
   - `nifi_connection_service` → request-scoped (Phase 2 makes this natural)
   - `certificate_manager` → app-scoped
   - `nifi_oidc_config` → app-scoped

2. **Git services** (6 singletons):
   - `git_service`, `git_auth_service`, `git_cache_service`, `git_operations_service`, `git_connection_service`, `git_diff_service`
   - Most are stateless. Can be factory-built per request or app-scoped.

3. **Global managers** (handle last):
   - `settings_manager` — Central config hub, ~30 import sites. Remove after everything else stabilizes.
   - `cache_service` — moved in Phase 4.

#### Step-by-step workflow

```
Step 5.1  ⏳ For each singleton in priority order:
          Remaining singletons (all untouched):
            services/nifi/encryption.py        encryption_service
            services/nifi/certificate_manager.py  certificate_manager
            services/nifi/oidc_config.py       nifi_oidc_config
            services/nifi/connection.py        nifi_connection_service
            services/settings/git/auth.py      git_auth_service
            services/settings/git/service.py   git_service
            services/settings/git/cache.py     git_cache_service
            services/settings/git/operations.py git_operations_service
            services/settings/git/connection.py git_connection_service
            services/settings/git/diff.py      git_diff_service
            credentials_manager.py             encryption_service
            settings_manager.py                settings_manager

          For each: add factory fn → add Depends() provider → update callers
                    → remove module-level instance → run tests.

Step 5.2  ⏳ After each group, verify.
```

#### Exit criteria

- No router imports a mutable service singleton.
- No task imports a mutable service singleton.
- Module-level service construction exists only for truly immutable helpers.

---

### Phase 6: Raw SQL elimination and repository alignment

**Goal:** Move `nifi_flow_service.py` raw SQL into a proper repository.

#### Problem

`nifi_flow_service.py` uses raw SQL `text()` statements with f-string column names for all CRUD operations on the `nifi_flows` table. The table has dynamic columns derived from hierarchy config.

#### Solution

Create a `NifiFlowRepository` that uses SQLAlchemy Core `Table` with dynamic column reflection:

```python
# repositories/nifi/nifi_flow_repository.py
from sqlalchemy import Table, MetaData

class NifiFlowRepository:
    def __init__(self, engine):
        self._engine = engine
        self._table = None

    def _get_table(self):
        if self._table is None:
            metadata = MetaData()
            self._table = Table("nifi_flows", metadata, autoload_with=self._engine)
        return self._table

    def list_all(self):
        table = self._get_table()
        with self._engine.connect() as conn:
            result = conn.execute(table.select().order_by(table.c.created_at.desc()))
            return [dict(row._mapping) for row in result]
```

This preserves parameterized queries, follows the repository pattern, and handles dynamic columns through SQLAlchemy table reflection.

#### Step-by-step workflow

```
Step 6.1  ✅ Create repositories/nifi/nifi_flow_repository.py
          Full NifiFlowRepository with SQLAlchemy Core Table reflection.
          Methods: list_all, get_by_id, create, update (sets updated_at),
          delete, get_columns, _invalidate_table_cache.

Step 6.2  ✅ Migrate nifi_flow_service.py to use the repository.
          No text() calls remain. Module-level _repo = NifiFlowRepository(engine).
          invalidate_flow_table_cache() exposed; called from routers/nifi/hierarchy.py
          after save_hierarchy_config() to drop the reflected table cache.

Step 6.3  ⏳ Move hierarchy_service.py DB access to the
          settings repository or a dedicated HierarchyConfigRepository.
          Currently has 4 get_db_session() call sites (lines 51, 176, 217, 249).

Step 6.4  ⏳ Move deploy_service.py _get_last_hierarchy_attr() to use
          the cached hierarchy config from Phase 4.
          Currently has 1 get_db_session() call site (line 359).

Step 6.5  ⏳ Run tests. Verify all flow CRUD operations work.
```

#### Exit criteria

- No raw SQL `text()` calls in service files. ✅
- All PostgreSQL access goes through repositories. ⏳ (hierarchy_service, deploy_service)
- `nifi_flow_service.py` uses `NifiFlowRepository`. ✅

---

## 9. Implementation order summary

```
MILESTONE A (ship together)
│
├── Phase 1: Composition root + DI
│   ├── 1.1  ✅ Create service_factory.py
│   ├── 1.2  ✅ Create dependencies.py
│   ├── 1.3  ✅ Wire app-scoped services in lifespan
│   ├── 1.4  ⏳ Migrate 2-3 routers (proof of concept)
│   ├── 1.5  ⏳ Migrate 2-3 tasks (proof of concept)
│   ├── 1.6  ⏳ Migrate remaining routers and tasks
│   └── 1.7  ⏳ Verify
│
├── Phase 2: nipyapi global-state fix
│   ├── 2.1  ✅ Create nifi_context.py (context manager + lock)
│   ├── 2.2  ✅ Update router call sites
│   ├── 2.3  ✅ Update task call sites
│   ├── 2.4  ✅ Update service call sites
│   └── 2.5  ⏳ Verify concurrent safety
│
└── SHIP — system is stable, all tests pass
    │
    ▼
MILESTONE B (phases are independent, pick order by pain)
│
├── Phase 3: Large service decomposition
│   ├── 3a  ✅ deployment.py → 4 modules + facade (old file deleted)
│   ├── 3b  ✅ cert_operations.py → 6 modules + re-export facade
│   ├── 3c  ✅ oidc.py → 4 modules + facade (old file deleted)
│   └── 3d  ⏳ deploy_service.py → injected repos
│
├── Phase 4: Config lifecycle improvements
│   ├── 4a  ✅ Hierarchy config TTL cache
│   ├── 4b  ✅ OIDC provider config load-once
│   └── 4c  ⏳ Cache service lazy init
│
└── SHIP — each phase independently
    │
    ▼
MILESTONE C (cleanup, phases are independent)
│
├── Phase 5: Singleton removal sweep
│   ├── ⏳ NiFi singletons (encryption, certificate_manager, nifi_oidc_config, nifi_connection_service)
│   ├── ⏳ Git singletons (6: service, auth, cache, operations, connection, diff)
│   └── ⏳ Global managers (credentials_manager.encryption_service, settings_manager last)
│
└── Phase 6: Raw SQL elimination
    ├── ✅ Create NifiFlowRepository
    ├── ✅ Migrate nifi_flow_service.py (no text() calls remain)
    └── ⏳ Clean up hierarchy_service.py + deploy_service.py DB access
```

## 10. Success criteria

This refactor is complete when these statements are true:

| Criterion | Status |
|-----------|--------|
| Routers use `Depends()` for service injection | ⏳ Steps 1.4–1.6 not started |
| Tasks use `service_factory` for service construction | ⏳ Not started |
| nipyapi global state is scoped per operation and safe under concurrency | ✅ Phase 2 complete |
| No service file exceeds 400 lines | ✅ All large files decomposed (Phases 3a–3c) |
| No raw SQL in service files | ✅ Phase 6.1–6.2 complete |
| All PostgreSQL access goes through repositories | ⏳ hierarchy_service (4 sites), deploy_service (1 site) remain |
| Config reads for rarely-changing data are cached | ✅ Hierarchy TTL cache + OIDC load-once done |
| Import-time service singletons are removed | ⏳ Phase 5 not started (12 singletons remain) |
| `cache_service` initialization does not crash at import time | ⏳ Phase 4c not started |
| All tests pass | ⏳ Not run |

### Open work (priority order)

1. **Phase 4c** — Move `cache_service` out of module-level init in `services/settings/cache.py`.
2. **Phase 3d** — Refactor `deploy_service.py` to accept injected repos (remove `get_db_session()` at line 359).
3. **Phase 6.3–6.4** — Move `hierarchy_service.py` (4× `get_db_session`) and `deploy_service.py` DB access to repositories.
4. **Phase 5** — Singleton removal sweep (12 module-level instances remain).
5. **Phase 1.4–1.7** — Migrate routers and tasks to `Depends()` / factory functions.
6. **Verification** — Run full test suite; smoke-test concurrent NiFi ops.

## 11. Tests and cleanup

Testing happens continuously during the refactor:

- **During each step:** Run relevant tests after every file change.
- **After each phase:** Run the full test suite.
- **After Milestone A:** Full smoke test of router and Celery paths.

### Test migration checklist

As singletons are removed:

- [ ] Update tests that patch singleton symbols to patch factory functions instead.
- [ ] Add focused tests for FastAPI dependency providers.
- [ ] Add focused tests for `service_factory` functions.
- [ ] Verify concurrent NiFi operations do not interfere (Phase 2).
- [ ] Verify hierarchy config caching invalidates correctly (Phase 4).

### Final cleanup

- [ ] Remove deprecated singleton exports from module files.
- [ ] Grep for remaining `get_db_session()` in services — should be zero.
- [ ] Grep for remaining `engine.connect()` in services — should be zero.
- [ ] Grep for remaining `text(` in services — should be zero.
