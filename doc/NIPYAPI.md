# NiPyAPI Integration Reference

## Overview

[nipyapi](https://nipyapi.readthedocs.io/) is the primary client library used to communicate with Apache NiFi instances in this application. It provides Python bindings for the NiFi REST API and is used for flow deployment, monitoring, configuration management, and operational tasks.

All NiFi-related code lives under `/backend/services/nifi/`.

---

## Authentication

**File:** `/backend/services/nifi/connection.py` — `NifiConnectionService`

The application implements a **three-priority authentication strategy**. When configuring a NiFi connection, the service checks for credentials in this order:

### Priority 1: OIDC (OpenID Connect)

Triggered when the `NifiInstance` model has an `oidc_provider_id` set.

- Provider configuration loaded from `oidc_providers.yaml`
- Client credentials resolved via `nifi_oidc_config.get_oidc_provider()`
- Calls `nipyapi.security.service_login_oidc()` with token endpoint URL, client_id, and client_secret
- Supports custom CA certificate paths for OIDC token requests
- `ssl_verify` parameter accepts a boolean or a file path string (for custom CA bundles)

### Priority 2: Client Certificate Authentication

Triggered when `certificate_name` is set on the instance.

- Certificate paths loaded from `certificate_manager.get_certificate_paths()`
- Creates an `ssl.SSLContext` and loads the certificate chain (with optional password)
- Sets nipyapi config attributes: `cert_file`, `key_file`, `ssl_ca_cert`, `ssl_context`
- Validates all files exist (CA cert, client cert, client key) before attempting
- Logs certificate metadata (subject, issuer, expiry) via OpenSSL subprocess for debugging

### Priority 3: Username/Password

Triggered when `username` and `password_encrypted` are set on the instance.

- Password decrypted via `encryption_service.decrypt()`
- Sets `config.nifi_config.username` and `config.nifi_config.password`
- Calls `nipyapi.security.service_login()` to authenticate and validate credentials immediately

### SSL Configuration

```python
config.nifi_config.verify_ssl = verify_ssl        # bool
config.nifi_config.check_hostname = check_hostname # bool (separate from verify_ssl)
nipyapi.config.disable_insecure_request_warnings = True  # when SSL disabled
```

### URL Normalization

The connection service normalizes all NiFi URLs to ensure the `/nifi-api` suffix is present:

```python
nifi_url = nifi_url.rstrip("/")
if nifi_url.endswith("/nifi-api"):
    nifi_url = nifi_url[:-9]
nifi_url = "%s/nifi-api" % nifi_url
```

### Connection Scope

`nipyapi.config.nifi_config` is a **global singleton**. Configuring a new instance overwrites the previous connection. The retry wrapper in `/backend/routers/nifi/operations.py` always calls `configure_from_instance()` before each operation to ensure the correct instance is active.

---

## Deployment

**Files:** `/backend/services/nifi/deploy_service.py`, `/backend/services/nifi/deployment.py`

The `deploy_flow()` function implements a 12-step orchestration pipeline:

### Step 1 — Resolve Registry Template

Looks up the flow template from the database (`RegistryFlowRepository`) to get `bucket_id`, `flow_id`, and `registry_client_id`. Alternatively, these can be passed directly.

### Step 2 — Resolve Parent Process Group

Finds or creates the full process group hierarchy by path (see [Process Group Path Resolution](#process-group-path-resolution) below).

### Steps 3–5 — Registry & Version Resolution

```python
bucket_id, flow_id = service.get_bucket_and_flow_identifiers(...)
version = service.get_deploy_version(requested_version, ...)
```

Uses `nipyapi.versioning.list_registry_clients()`, `get_registry_bucket()`, and `get_flow_in_bucket()` to resolve identifiers and available versions.

### Step 6 — Deploy Flow Version

```python
# Auto-position the new process group in the parent's canvas
nipyapi.layout.align_pg_grid(parent_pg_id, sort_by_name=True)
x, y = nipyapi.layout.suggest_pg_position(parent_pg_id)

deployed_pg = nipyapi.versioning.deploy_flow_version(
    parent_id=parent_pg_id,
    location=(x, y),
    bucket_id=bucket_id,
    flow_id=flow_id,
    reg_client_id=registry_client_id,
    version=version,
)
```

### Step 7 — Rename Process Group

```python
nipyapi.canvas.update_process_group(pg=deployed_pg, update={"name": new_name})
```

### Step 8 — Assign Parameter Context

```python
context = nipyapi.parameters.get_parameter_context(
    identifier=parameter_context_name,
    identifier_type="name",
    greedy=True
)
nipyapi.parameters.assign_context_to_process_group(pg=pg, context_id=context.id, cascade=False)
```

Also supports direct context ID assignment via `ParameterContextsApi`.

### Step 9 — Auto-Connect Ports

Intelligently connects output ports to input ports based on the instance's `hierarchy_attribute` and `hierarchy_value` configuration. Finds `RouteOnAttribute` processors and configures routing strategies. Uses:

```python
nipyapi.canvas.create_connection(source=port, target=port, name="...", relationships=[...])
```

### Step 10 — Stop Version Control (optional)

```python
nipyapi.versioning.stop_flow_ver(pg, refresh=True)
```

### Steps 11–12 — Disable and/or Start (optional)

```python
# Disable all processors and ports
for processor in nipyapi.canvas.list_all_processors(pg_id):
    ProcessorsApi().update_run_status4(
        body=ProcessorRunStatusEntity(state="DISABLED", revision=...),
        id=processor.id
    )

# Start the process group
nipyapi.canvas.schedule_process_group(pg_id, scheduled=True, identifier_type="id")
```

### Process Group Path Resolution

**File:** `/backend/services/nifi/install_service.py`

`find_or_create_process_group_by_path(path)` resolves a slash-separated path like `"Root/Level1/Level2"`:

1. Calls `nipyapi.canvas.get_root_pg_id()` to get the starting point
2. Lists all existing process groups with `nipyapi.canvas.list_all_process_groups()`
3. Builds a UUID → path map by traversing parent references
4. Returns the UUID if an exact path match is found
5. Creates missing hierarchy levels one-by-one using `nipyapi.canvas.create_process_group()`

---

## Monitoring

**Files:** `/backend/services/nifi/operations/management.py`, `/backend/services/nifi/operations/process_groups.py`

### System Diagnostics

```python
diagnostics = nipyapi.system.get_system_diagnostics()
# Returns: heap usage, CPU load, thread counts, storage info
```

### Process Group Status

Two API layers are used depending on the level of detail needed:

**High-level (Canvas API) — for component counts:**
```python
pg_entity = nipyapi.canvas.get_process_group_status(pg_id=pg_id, detail="all")
# Fields: running_count, stopped_count, disabled_count, stale_count
```

**Low-level (Flow API) — for recursive/nodewise breakdown:**
```python
status = nipyapi.nifi.FlowApi().get_process_group_status(
    id=pg_id,
    recursive=True,
    nodewise=False,
)
```

### Status Evaluation

`evaluate_process_group_status(counters, expected_status)` maps expected states to counter assertions:

| Expected Status | Condition |
|----------------|-----------|
| `"Running"` | `stale_count=0`, `stopped_count=0`, `disabled_count=0` |
| `"Stopped"` | `running_count=0`, `stale_count=0`, `disabled_count=0` |
| `"Disabled"` | `running_count=0`, `stale_count=0`, `stopped_count=0` |
| `"Enabled"` | `disabled_count=0` |

### Queue Monitoring

NiFi queue sizes are returned as formatted strings (e.g., `"1,234 (5.67 MB)"`). The application parses these and applies traffic-light thresholds:

```python
count = parse_queued_count("1,234 (5.67 MB)")    # → 1234
mb    = parse_queued_bytes_mb("1,234 (5.67 MB)")  # → 5.67

status = evaluate_queue_status(count, yellow_threshold, red_threshold)
# Returns: "green" | "yellow" | "red"
```

---

## Provenance

**File:** `/backend/services/nifi/operations/provenance.py`

Both functions follow the same submit → poll → cleanup pattern: a query is submitted to NiFi, polled until `finished`, and then deleted from NiFi in a `finally` block regardless of outcome. The poll interval is 0.5 s with a 30 s timeout.

### Component Provenance Events

```python
get_component_provenance_events(
    component_id: str,
    max_results: int = 100,
    start_date: str | None = None,  # ISO-8601 e.g. "2024-01-01T00:00:00Z"
    end_date: str | None = None,
) -> dict
```

Submits a `ProvenanceEntity` using `ProcessorID` as the search term (works for processors, ports, and other components), polls via `ProvenanceApi.get_provenance()`, and returns the full result dict.

HTTP endpoint: `GET /{instance_id}/ops/provenance/component/{component_id}?max_results=&start_date=&end_date=`

### Flow Lineage

```python
get_flow_lineage(
    flow_file_uuid: str,
    component_id: str | None = None,  # Optional — annotates starting node
) -> dict
```

Traces the complete path of a FlowFile through the NiFi flow. Submits a `LineageEntity` with `lineage_request_type="FLOWFILE"`, polls via `ProvenanceApi.get_lineage()`, then enriches each lineage node by fetching the full event detail from `ProvenanceEventsApi.get_provenance_event()`.

Returns:
```json
{
  "flow_file_uuid": "...",
  "component_id": "...",
  "ordered_path": [
    {
      "event_id": "...",
      "component_id": "...",
      "component_name": "...",
      "component_type": "...",
      "event_type": "...",
      "timestamp": "...",
      "millis": 0,
      "is_starting_component": false
    }
  ],
  "links": [{"source_id": "...", "target_id": "..."}],
  "event_count": 0
}
```

Virtual source/sink nodes (whose `id` equals the FlowFile UUID) are skipped during enrichment. Nodes are ordered by lineage `millis` (elapsed time).

HTTP endpoint: `GET /{instance_id}/ops/provenance/lineage/{flow_file_uuid}?component_id=`

---

## Core nipyapi Modules Used

| Module | Usage |
|--------|-------|
| `nipyapi.canvas` | Process group and processor CRUD, connections, scheduling |
| `nipyapi.versioning` | Registry clients, buckets, flow versions, deploy/export/import |
| `nipyapi.security` | `service_login()`, `service_login_oidc()` |
| `nipyapi.parameters` | Get and assign parameter contexts |
| `nipyapi.layout` | Auto-position process groups (`align_pg_grid`, `suggest_pg_position`) |
| `nipyapi.system` | System diagnostics |
| `nipyapi.config` | Global connection config (`nifi_config`) |
| `nipyapi.nifi.FlowApi` | Low-level flow status, parameter contexts, buckets |
| `nipyapi.nifi.ProcessGroupsApi` | Low-level process group operations |
| `nipyapi.nifi.ProcessorsApi` | Low-level processor run status updates |
| `nipyapi.nifi.InputPortsApi` / `OutputPortsApi` | Port management |
| `nipyapi.nifi.ParameterContextsApi` | Full parameter context lifecycle |
| `nipyapi.nifi.ProvenanceApi` | Submit/poll/delete provenance queries and lineage requests |
| `nipyapi.nifi.ProvenanceEventsApi` | Fetch individual provenance event details |

---

## Error Handling & Retry

**File:** `/backend/routers/nifi/operations.py` — `_execute_with_retry()`

The retry wrapper distinguishes between logical errors (no retry) and transient network failures (retry with backoff):

```python
for attempt in range(1, _NIFI_MAX_RETRIES + 1):
    try:
        nifi_connection_service.configure_from_instance(instance)  # Re-auth each attempt
        return operation()
    except (ValueError, HTTPException):
        raise  # Logical error — resource not found, bad request, etc.
    except Exception as exc:
        if attempt < _NIFI_MAX_RETRIES:
            await asyncio.sleep(_NIFI_RETRY_DELAY)
        else:
            raise
```

All nipyapi response objects are accessed defensively using `hasattr()` or `getattr(..., default)` before attribute access, since the generated API client models do not guarantee all fields are populated.

---

## Logging

nipyapi and urllib3 HTTP logs are suppressed to avoid noise:

```python
logging.getLogger("nipyapi").setLevel(logging.WARNING)
logging.getLogger("nipyapi.nifi.rest").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
```

---

## Key File Locations

| File | Purpose |
|------|---------|
| `/backend/services/nifi/connection.py` | Authentication & connection setup |
| `/backend/services/nifi/deploy_service.py` | High-level deployment API |
| `/backend/services/nifi/deployment.py` | 12-step deployment orchestration |
| `/backend/services/nifi/install_service.py` | Process group path resolution |
| `/backend/services/nifi/operations/registries.py` | Registry & flow listing |
| `/backend/services/nifi/operations/flows.py` | Flow export/import |
| `/backend/services/nifi/operations/process_groups.py` | PG lifecycle & status evaluation |
| `/backend/services/nifi/operations/processors.py` | Processor configuration |
| `/backend/services/nifi/operations/parameters.py` | Parameter context management |
| `/backend/services/nifi/operations/versions.py` | Version control operations |
| `/backend/services/nifi/operations/connections.py` | Connection testing |
| `/backend/services/nifi/operations/management.py` | Queue monitoring & status parsing |
| `/backend/services/nifi/operations/provenance.py` | Provenance events & flow lineage |
| `/backend/routers/nifi/operations.py` | HTTP endpoints with retry wrapper |
