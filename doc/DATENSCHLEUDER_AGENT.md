# Datenschleuder Agent

## Overview

A lightweight Python daemon deployed on infrastructure nodes (NiFi cluster nodes, etc.) that executes commands remotely via Redis Pub/Sub. The backend sends JSON-encoded commands to a Redis channel; the agent executes them and publishes results back.

**Location:** `scripts/datenschleuder_agent/`
**Production path:** `/opt/datenschleuder-agent/`
**Python:** 3.9+, Dependencies: `redis`, `python-dotenv`

---

## Architecture

```
Backend → Redis PUBLISH datenschleuder-agent:{agent_id} → Agent
Agent   → Redis PUBLISH datenschleuder-agent-response:{agent_id} → Backend
Agent   → Redis HSET agents:{agent_id} (heartbeat/registry)
```

### Components

| File | Role |
|------|------|
| `agent.py` | Main entry point; Redis connection, Pub/Sub listener, reconnect/buffering logic |
| `config.py` | Loads `.env`, validates, exposes typed config + channel name helpers |
| `executor.py` | Pluggable command registry; dispatches, enforces timeouts, formats responses |
| `heartbeat.py` | Background thread; updates `agents:{agent_id}` hash every 30s |

---

## Supported Commands

| Command | Params | Description |
|---------|--------|-------------|
| `echo` | `message` | Health check / ping |
| `git_pull` | `repository_path`, `branch` | Pull branch on whitelisted repo |
| `git_status` | `repository_path` | Git status on whitelisted repo |
| `nifi_restart` | — | Restart configured NiFi containers |
| `zookeeper_restart` | — | Restart configured ZooKeeper containers |
| `docker_stats` | — | Stats for all running containers |
| `docker_ps` | — | List running containers |

**Security:** git paths and container names are whitelisted via config. Subprocess is called with list args (no shell injection). Agent runs as non-root user in the `docker` group.

---

## Message Format

**Command (sent to agent):**
```json
{
  "command_id": "unique-uuid",
  "command": "git_pull",
  "params": { "repository_path": "/opt/app/config", "branch": "main" }
}
```

**Response (published by agent):**
```json
{
  "command_id": "unique-uuid",
  "status": "success",
  "output": "...",
  "error": null,
  "execution_time_ms": 312,
  "timestamp": 1234567890
}
```

---

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(required)* | Redis auth password |
| `REDIS_DB` | `0` | Redis DB number |
| `AGENT_ID` | hostname | Unique node identifier |
| `GIT_REPO_PATH` | `/opt/app/config` | Comma-separated whitelisted git repos |
| `NIFI_CONTAINERS` | `nifi` | Comma-separated NiFi container names |
| `ZOOKEEPER_CONTAINER` | *(empty)* | Comma-separated ZooKeeper container names |
| `HEARTBEAT_INTERVAL` | `30` | Seconds between heartbeat updates |
| `COMMAND_TIMEOUT` | `30` | Timeout (s) for git/docker ps/stats |
| `DOCKER_TIMEOUT` | `60` | Timeout (s) for container restart |
| `LOGLEVEL` | `INFO` | Python log level |

---

## Redis Data Structures

**Agent Registry Hash** (TTL = 3× heartbeat_interval):
```
Key:    agents:{agent_id}
Fields: status, last_heartbeat, agent_id, version,
        capabilities, started_at, commands_executed
```

**Channels:**
- Commands: `datenschleuder-agent:{agent_id}`
- Responses: `datenschleuder-agent-response:{agent_id}`

---

## Lifecycle

1. Load & validate config
2. Connect to Redis (retries every 10s)
3. Register agent in `agents:{agent_id}` hash
4. Start `HeartbeatThread`
5. Subscribe to command channel, enter listen loop
6. On Redis disconnect: buffer commands (max 100), reconnect, flush buffer
7. On `SIGTERM`/`SIGINT`: stop heartbeat → mark offline → close Redis → exit

---

## Adding a New Command

In `executor.py`, register a handler in `__init__`:
```python
self.register("my_command", self._execute_my_command)

async def _execute_my_command(self, params: dict) -> dict:
    # validate params, run subprocess, return {"output": ..., "error": ...}
```

---

## Deployment

```bash
# Production - systemd
sudo systemctl start datenschleuder-agent
sudo journalctl -u datenschleuder-agent -f

# Development
cd scripts/datenschleuder_agent
cp .env.example .env  # edit as needed
python agent.py
```

**Service file:** `scripts/datenschleuder_agent/datenschleuder-agent.service`
