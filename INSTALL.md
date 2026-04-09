# Datenschleuder Installation Guide

This guide covers how to install and deploy Datenschleuder using Docker.

---

## Prerequisites

### Required Software
- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)
- **Git**

### Hardware Requirements
- **Minimum**: 2 CPU cores, 4 GB RAM, 20 GB disk space
- **Recommended**: 4 CPU cores, 8 GB RAM, 50 GB disk space

### Network Requirements
- Access to your NiFi instance(s) (API + mutual TLS)
- Outbound internet access for Docker image pulls (or pre-pulled images for air-gapped environments)

---

## Architecture Overview

Datenschleuder runs as a multi-container Docker environment:

| Container | Service | Purpose |
|-----------|---------|---------|
| `datenschleuder-web` | Frontend + Backend API | Web interface (Next.js) and REST API (FastAPI) |
| `datenschleuder-worker` | Celery Worker | Background task execution |
| `datenschleuder-worker-backup` | Celery Worker (Backup) | Dedicated worker for backup tasks |
| `datenschleuder-beat` | Celery Beat | Periodic task scheduler |
| `datenschleuder-postgres` | PostgreSQL | Database for persistent storage |
| `datenschleuder-redis` | Redis | Message broker and caching |

```
                    ┌─────────────────┐
                    │   Web Browser   │
                    └────────┬────────┘
                             │ :3000
                    ┌────────▼──────────────┐
                    │  datenschleuder-web   │
                    │  (Frontend + Backend) │
                    └────────┬──────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────────┐  ┌──▼───┐  ┌───────▼───────┐
     │    worker(s)    │  │redis │  │   postgres    │
     │  (Celery/Beat)  │  └──────┘  │  (Database)   │
     └─────────────────┘            └───────────────┘
```

---

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/nerdfunk-net/datenschleuder.git
cd datenschleuder
```

### Step 2: Configure Environment Variables

Copy the example environment file and edit it:

```bash
cp docker/.env.example docker/.env
```

Edit `docker/.env` with your settings:

```bash
# Frontend Configuration
FRONTEND_PORT=3000

# Database Configuration
POSTGRES_DB=datenschleuder
POSTGRES_USER=datenschleuder
POSTGRES_PASSWORD=your_secure_password_here

# Redis Configuration
DATENSCHLEUDER_REDIS_PASSWORD=your_redis_password_here

# Security
SECRET_KEY=your-secret-key-change-this-in-production

# Logging
LOG_LEVEL=INFO
```

> **Important**: Change all default passwords and the `SECRET_KEY` for production deployments!

### Step 3: Configure Certificates

Datenschleuder uses mutual TLS to communicate with NiFi. You need to prepare certificates before the application can connect to NiFi instances.

Copy the example and edit it:

```bash
cp config/nipyapi/certificates.yaml.example config/nipyapi/certificates.yaml
```

Edit `config/nipyapi/certificates.yaml`:

```yaml
certificates:
  - name: "nipyapi"
    ca_cert_file: "ca_cert.pem"
    cert_file: "nipyapi.crt.pem"
    key_file: "nipyapi.key.pem"
    password: your_password
```

Place your certificate files in a location accessible by the backend. Certificate-based authentication is preferred over OIDC.

### Step 4: Configure OIDC/SSO (Optional)

Copy the bundled example and edit it:

```bash
cp config/oidc_providers.yaml.example config/oidc_providers.yaml
```

```yaml
providers:
  keycloak:
    enabled: true
    display_name: "Company SSO"
    issuer: "https://keycloak.example.com/realms/myrealm"
    client_id: "datenschleuder"
    client_secret: "your-client-secret"
```

### Step 5: Start the Application

Navigate to the docker directory and start all containers:

```bash
cd docker
docker compose up -d
```

This will:
1. Pull all required Docker images
2. Create the Docker network
3. Start PostgreSQL and Redis
4. Build and start the web application (frontend + backend)
5. Start the Celery workers and beat scheduler

### Step 6: Verify the Installation

Check that all containers are running:

```bash
docker compose ps
```

Expected output:
```
NAME                              STATUS          PORTS
datenschleuder-beat               Up
datenschleuder-postgres           Up (healthy)    5432/tcp
datenschleuder-redis              Up (healthy)    6379/tcp
datenschleuder-web                Up (healthy)    0.0.0.0:3000->3000/tcp, 0.0.0.0:8000->8000/tcp
datenschleuder-worker             Up
datenschleuder-worker-backup      Up
```

### Step 7: Access the Application

Open your web browser and navigate to:

- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs

### Step 8: Initial Login

Use the default credentials to log in:

- **Username**: `admin`
- **Password**: `admin`

> **Important**: Change the default password immediately after first login!

---

## Post-Installation Configuration

After installation, follow the [SETUP.md](SETUP.md) guide to configure the application for your environment. The setup covers:

1. **Hierarchy** — define the attribute structure for NiFi instance identification
2. **Git Credentials** — add credentials for Git repository access
3. **Git Repository** — connect the repository that stores NiFi configuration files
4. **NiFi Cluster Wizard** — register NiFi servers, instances, and clusters
5. **Registry Flows** — register NiFi Registry flows to manage
6. **Deployment Paths** — map clusters to source/destination process groups

---

## Directory Structure

```
datenschleuder/
├── docker/
│   ├── docker-compose.yml          # Main Docker Compose file
│   ├── .env                        # Environment configuration (create from .env.example)
│   └── .env.example                # Example environment file
├── config/                         # Mounted into containers at /app/config
│   ├── nipyapi/
│   │   └── certificates.yaml       # nipyapi certificate configuration
│   ├── oidc_providers.yaml         # OIDC/SSO configuration (copy from .example)
│   └── oidc_providers.yaml.example # Bundled template
├── backend/                        # Backend source code
└── frontend/                       # Frontend source code
```

> **Note**: Application data is stored in the `datenschleuder_data` Docker volume. Use `docker volume inspect datenschleuder_data` to find the mount path.

---

## Updating Datenschleuder

To update to a newer version:

```bash
cd datenschleuder

# Pull the latest changes
git pull

# Rebuild and restart containers
cd docker
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Troubleshooting

### View Container Logs

```bash
# All containers
docker compose logs

# Specific container
docker compose logs datenschleuder-web
docker compose logs datenschleuder-worker

# Follow logs in real-time
docker compose logs -f datenschleuder-web
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart datenschleuder-worker
```

### Reset the Database

> **Warning**: This will delete all data!

```bash
docker compose down -v
docker compose up -d
```

### Check Service Health

```bash
# Health endpoint
curl http://localhost:8000/health

# Container status
docker compose ps
```

### Common Issues

#### Container fails to start
- Check logs: `docker compose logs <container-name>`
- Verify `.env` file exists and has correct values
- Ensure ports 3000 and 8000 are not in use

#### Cannot connect to NiFi
- Verify certificate paths and contents in `config/nipyapi/certificates.yaml`
- Ensure the NiFi host is reachable from the Docker network
- Check the backend logs for TLS handshake errors

#### Celery tasks not running
- Check worker logs: `docker compose logs datenschleuder-worker`
- Verify Redis is running: `docker compose ps datenschleuder-redis`
- Restart the worker: `docker compose restart datenschleuder-worker`

---

## Air-Gapped Installation

For environments without internet access, see [docker/README-ALL-IN-ONE.md](docker/README-ALL-IN-ONE.md) for air-gapped deployment instructions.

---

## Additional Resources

- [SETUP.md](SETUP.md) - Initial configuration and NiFi cluster setup
- [docker/README.md](docker/README.md) - Docker deployment options
- [docker/DOCKER.md](docker/DOCKER.md) - Docker troubleshooting
