# Datenschleuer Agent - Remote Command Executor

Lightweight Python agent that runs on remote hosts to execute commands remotely from Datenschleuer.

## Features

- **Remote Command Execution**: git pull, docker restart, health checks
- **Redis Pub/Sub**: Real-time command delivery via Redis
- **Health Monitoring**: Automatic heartbeat every 30s
- **Command Buffering**: Queue commands locally when Redis is unavailable
- **Pluggable Architecture**: Easy to add custom commands
- **Secure**: Whitelisted paths, no shell injection, validation

## Architecture

```
Datenschleuer Backend → Redis Pub/Sub → Datenschleuer Agent → Execute locally
                                        ↓
                                   Send Response
```

## Installation

### Prerequisites

- Python 3.9+
- Redis access to Datenschleuer Redis server
- Docker (for docker restart commands)
- Git (for git pull commands)

### Step 1: Create Agent User

```bash
# Create dedicated user
sudo useradd -r -s /bin/bash -d /opt/datenschleuder-agent datenschleuder-agent

# Add to docker group
sudo usermod -aG docker datenschleuder-agent

# Create home directory
sudo mkdir -p /opt/datenschleuder-agent
sudo chown datenschleuder-agent:datenschleuder-agent /opt/datenschleuder-agent
```

### Step 2: Install Agent

```bash
# Copy agent files
sudo cp -r scripts/grafana_agent/* /opt/datenschleuder-agent/
sudo chown -R datenschleuder-agent:datenschleuder-agent /opt/datenschleuder-agent

# Create virtual environment
sudo -u datenschleuder-agent python3 -m venv /opt/datenschleuder-agent/venv
sudo -u datenschleuder-agent /opt/datenschleuder-agent/venv/bin/pip install -r /opt/datenschleuder-agent/requirements.txt
```

### Step 3: Configure

```bash
# Copy environment template
sudo cp /opt/datenschleuder-agent/.env.example /opt/datenschleuder-agent/.env

# Edit configuration
sudo nano /opt/datenschleuder-agent/.env
```

**Required settings:**
```bash
REDIS_HOST=datenschleuder.example.com      # Datenschleuer Redis host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
GIT_REPO_PATH=/opt/app/config   # Git repo to pull
DOCKER_CONTAINER_NAME=grafana       # Container to restart
```

### Step 4: Install systemd Service

```bash
# Copy service file
sudo cp /opt/datenschleuder-agent/datenschleuder-agent.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable datenschleuder-agent
sudo systemctl start datenschleuder-agent

# Check status
sudo systemctl status datenschleuder-agent
```

## Usage

### Check Agent Status

```bash
# View logs
sudo journalctl -u datenschleuder-agent -f

# Check if running
sudo systemctl status datenschleuder-agent

# Restart agent
sudo systemctl restart datenschleuder-agent
```

### Manual Testing (via redis-cli)

```bash
# Connect to Redis
redis-cli -h datenschleuder.example.com -a your_password

# Check agent registration
HGETALL agents:app-prod-01

# Send echo command
PUBLISH datenschleuder-agent:app-prod-01 '{"command_id":"test-123","command":"echo","params":{"message":"hello"}}'

# Listen for response
SUBSCRIBE datenschleuder-agent-response:app-prod-01
```

## Supported Commands

### 1. Echo (Health Check)

```json
{
  "command": "echo",
  "params": {
    "message": "hello"
  }
}
```

Response: `{"status": "success", "output": "hello"}`

### 2. Git Pull

```json
{
  "command": "git_pull",
  "params": {
    "repository_path": "/opt/app/config",
    "branch": "main"
  }
}
```

Response: `{"status": "success", "output": "Already up to date."}`

### 3. Docker Restart

```json
{
  "command": "docker_restart",
  "params": {
    "container_name": "grafana"
  }
}
```

Response: `{"status": "success", "output": "grafana"}`

## Adding Custom Commands

Edit `executor.py` and register your handler:

```python
async def my_custom_handler(params: dict) -> dict:
    # Your logic here
    return {
        "status": "success",
        "output": "result",
        "error": None
    }

# In CommandExecutor.__init__()
self.register("my_command", my_custom_handler)
```

## Security

- **Whitelisting**: Only configured paths/containers allowed
- **No Shell Injection**: subprocess with list args
- **Validation**: All parameters validated before execution
- **Timeouts**: 30s for git, 60s for docker
- **User Isolation**: Runs as non-root datenschleuder-agent user
- **Logging**: All commands logged to syslog

## Troubleshooting

### Agent won't start

```bash
# Check logs
sudo journalctl -u datenschleuder-agent -n 50

# Common issues:
# - Redis connection failed → Check REDIS_HOST/PASSWORD
# - Permission denied → Check user/group ownership
# - Module not found → Check venv activation
```

### Commands not executing

```bash
# Check agent is online
redis-cli -h datenschleuder.example.com -a password HGETALL agents:your-hostname

# Check last_heartbeat is recent (< 90s ago)

# Check logs for errors
sudo journalctl -u datenschleuder-agent -f
```

### Git pull fails

```bash
# Test manually as datenschleuder-agent user
sudo -u datenschleuder-agent git -C /opt/app/config pull

# Common issues:
# - Not a git repo → git init or git clone
# - No remote origin → git remote add origin <url>
# - Permission denied → chown datenschleuder-agent:datenschleuder-agent
```

### Docker restart fails

```bash
# Test manually
sudo -u datenschleuder-agent docker restart grafana

# Common issues:
# - User not in docker group → usermod -aG docker datenschleuder-agent
# - Docker not running → systemctl start docker
# - Container doesn't exist → docker ps -a
```

## Monitoring

### Health Check

Agent is healthy if:
- `status` = "online"
- `last_heartbeat` < 90 seconds ago
- Responds to echo commands

### Metrics

- Commands executed: `commands_executed` field
- Uptime: `started_at` timestamp
- Last activity: `last_heartbeat` timestamp

## Redis Data Structures

### Agent Registry
```
Key: agents:{hostname}
Type: Hash
Fields:
  - status: online|offline
  - last_heartbeat: Unix timestamp
  - version: 1.0.0
  - hostname: app-prod-01
  - capabilities: git_pull,docker_restart,echo
  - started_at: Unix timestamp
  - commands_executed: Counter
```

### Pub/Sub Channels
```
Command channel: datenschleuder-agent:{hostname}
Response channel: datenschleuder-agent-response:{hostname}
```

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| REDIS_HOST | localhost | Redis server host |
| REDIS_PORT | 6379 | Redis server port |
| REDIS_PASSWORD | - | Redis password (required) |
| REDIS_DB | 0 | Redis database number |
| AGENT_HOSTNAME | hostname | Agent identifier (auto-detected) |
| GIT_REPO_PATH | /opt/app/config | Git repository path |
| DOCKER_CONTAINER_NAME | grafana | Docker container name |
| HEARTBEAT_INTERVAL | 30 | Heartbeat interval (seconds) |
| COMMAND_TIMEOUT | 30 | Git command timeout (seconds) |
| DOCKER_TIMEOUT | 60 | Docker command timeout (seconds) |

## License

Same as Datenschleuer-NG project
