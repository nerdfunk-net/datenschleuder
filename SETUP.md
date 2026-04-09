# Setup Guide

This guide walks you through the initial setup of Datenschleuder after installation.

## Before You Begin: Certificates

Datenschleuder uses mutual TLS to communicate with NiFi. Prepare the following certificates before starting:

| Certificate | Purpose |
|---|---|
| **Client certificate** | Your personal certificate to log in to NiFi |
| **Keystore (per instance)** | Each NiFi node's own certificate |
| **Truststore** | CA certificate trusted by all nodes |
| **nipyapi certificate** | Used by the backend to access NiFi via nipyapi (or use OIDC instead) |

### Configure nipyapi Certificates

Edit `./config/nipyapi/certificates.yaml` with the paths to your nipyapi certificate files:

```yaml
certificates:
  - name: "nipyapi"
    ca_cert_file: "ca_cert.pem"
    cert_file: "nipyapi.crt.pem"
    key_file: "nipyapi.key.pem"
    password: your_password
```

Certificate files should be placed in a location accessible by the backend process. Using certificate-based authentication is preferred over OIDC.

## Start the Backend

```bash
python ./start.py
```

The backend runs on `http://localhost:8000`. The frontend runs on `http://localhost:3000`.

Default credentials: `admin` / `admin` — change these immediately after first login.

---

## Setup Steps

### 1. Configure the Hierarchy

Navigate to **Settings > Hierarchy**.

The hierarchy defines the attribute structure used to identify and organize NiFi instances and flows. It maps to certificate subject attributes (e.g. `CN=test,O=myOrg,OU=myOrgUnit`).

**1a) Define hierarchy attributes**

Add attributes in order from top (highest level) to bottom (most specific). Each attribute has:
- **Name** — the attribute key (e.g. `O`, `OU`, `CN`)
- **Label** — a human-readable name (e.g. `Organization`, `Org Unit`, `Common Name`)

The preview at the bottom shows an example output based on your configuration.

**1b) Set values for the top-level attribute**

After saving the attribute structure, click the edit (pencil) icon next to the first/highest attribute to add its allowed values. At minimum, the top-level hierarchy attribute must have values configured — these are used to group NiFi clusters.

> **Warning:** Changing the hierarchy structure after flows have been configured will delete all existing flow associations. This cannot be undone.

---

### 2. Add a Credential for Git Access

Navigate to **Settings > Credentials**.

Add a credential that allows the backend to authenticate with your Git server. This is required before adding a Git repository.

Supported credential types:
- `ssh` — username + password
- `ssh_key` — username + private key (with optional passphrase or keyfile path)

Click **Add Credential** and fill in the name, username, type, and authentication details.

---

### 3. Add a Git Repository

Navigate to **Settings > Git**.

Add the Git repository that will store configuration files for each NiFi instance. Switch to the **Add Repository** tab and configure:

- **URL** — the clone URL of your repository
- **Branch** — the branch to use (default: `main`)
- **Auth Type** — select `ssh` or `ssh_key` and pick the credential created in step 2
- **Verify SSL** — uncheck if your Git server uses a self-signed certificate

Use the **Test Connection** button to verify connectivity before saving.

---

### 4. Run the Cluster Setup Wizard

Navigate to **Settings > NiFi** and click **Cluster Wizard**.

The wizard guides you through setting up a NiFi cluster. It will:

1. Discover or register your NiFi server(s) under the **Servers** tab
2. Create NiFi instances pointing to each node's URL under the **NiFi Instances** tab
3. Group instances into a cluster under the **Clusters** tab, assigning a hierarchy attribute/value pair

**Getting the correct certificate subject**

If you already have a running NiFi instance using a keystore and truststore, you can extract the correct certificate subject (DN) from the existing keystore. The subject must match the hierarchy format you configured in step 1 — for example:

```
CN=nifi-node-1,O=myOrg,OU=myOrgUnit
```

Each cluster is identified by a hierarchy attribute/value pair (e.g. `OU=production`). Instances in the cluster are the individual NiFi nodes.

---

### 5. Setup Registry Flows

Navigate to **Settings > Registry Flows**.

Register the NiFi Registry flows you want to manage. You can:

- **Add Flow** — reference an existing flow from a NiFi Registry bucket
- **Import Flow** — import a flow definition from a file

Flows are associated with a specific NiFi instance and registry. Once added, you can browse versions, manage metadata (tags), and export flows as JSON or YAML.

---

### 6. Configure Cluster Path Configuration

Navigate to **Settings > Deploy**.

This page maps each cluster to its source and destination process group paths within NiFi — required before deploying flows.

For each cluster:

1. Click **Load Paths** to fetch the process group tree from the primary NiFi instance
2. Select the **Source Path** — the process group under which hierarchy elements are looked up (relative to the top hierarchy attribute)
3. Select the **Destination Path** — where deployed flows are placed

You can also configure global deployment options:
- **Process Group Name Template** — template for naming deployed process groups (default: `{last_hierarchy_value}`)
- **Disable after deployment** — prevents accidental starting after deploy
- **Start after deployment** — automatically starts the deployed process group
- **Stop versioning after deployment** — disconnects the flow from version control after deploy

---

### 7. Setup Flows

Once the hierarchy, clusters, registry flows, and deployment paths are configured, you can deploy flows to your NiFi instances.

Use the **Deploy** section to select a registry flow version and target cluster, then trigger the deployment.

---

## Optional: Remote Agent Setup

The Datenschleuder Agent enables remote command execution on NiFi hosts — git pulls, NiFi/ZooKeeper restarts, Docker stats, and health checks — via Redis Pub/Sub.

### Step 1: Configure Redis

Navigate to **Settings > Redis** and click **Add Redis Server**.

Fill in the connection details:

| Field | Description |
|---|---|
| **Name** | A label for this Redis instance (e.g. `Primary`) |
| **Host** | Hostname or IP of the Redis server |
| **Port** | Redis port (default: `6379`) |
| **DB Index** | Redis database number (default: `0`) |
| **Password** | Redis password (required by the agent) |
| **Use TLS** | Enable if your Redis server requires TLS |

Save the server. The Redis connection will be used by agents and Celery workers.

### Step 2: Install the Agent on the NiFi Host

Copy the agent files from `./scripts/datenschleuder_agent/` to the NiFi host and run the following commands:

**Create a dedicated user:**

```bash
sudo useradd -r -s /bin/bash -d /opt/datenschleuder-agent datenschleuder-agent
sudo usermod -aG docker datenschleuder-agent
sudo mkdir -p /opt/datenschleuder-agent
sudo chown datenschleuder-agent:datenschleuder-agent /opt/datenschleuder-agent
```

**Install the agent:**

```bash
sudo cp -r scripts/datenschleuder_agent/* /opt/datenschleuder-agent/
sudo chown -R datenschleuder-agent:datenschleuder-agent /opt/datenschleuder-agent
sudo -u datenschleuder-agent python3 -m venv /opt/datenschleuder-agent/venv
sudo -u datenschleuder-agent /opt/datenschleuder-agent/venv/bin/pip install -r /opt/datenschleuder-agent/requirements.txt
```

**Configure the agent:**

```bash
sudo cp /opt/datenschleuder-agent/.env.example /opt/datenschleuder-agent/.env
sudo nano /opt/datenschleuder-agent/.env
```

Set the following values to match your environment:

```bash
REDIS_HOST=datenschleuder.example.com   # Redis host configured in step 1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# MODE=docker (Docker-based NiFi) or MODE=bare (bare-metal NiFi)
MODE=docker

# NiFi/ZooKeeper container names (comma-separated, docker mode only)
# NIFI_CONTAINERS=nifi
# ZOOKEEPER_CONTAINER=zookeeper
```

**Install and start the systemd service:**

```bash
sudo cp /opt/datenschleuder-agent/datenschleuder-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable datenschleuder-agent
sudo systemctl start datenschleuder-agent
sudo systemctl status datenschleuder-agent
```

Once the agent is running it will register itself in Redis using the host's hostname and send a heartbeat every 30 seconds. Datenschleuder will display connected agents and their status automatically.
