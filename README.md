# Datenschleuder

Datenschleuder is a web-based management dashboard for Apache NiFi. It centralizes the deployment, versioning, and monitoring of NiFi flows across multiple clusters — giving teams a single place to manage their entire NiFi landscape.

---

## What It Does

Managing NiFi across multiple clusters is tedious: deploying flows manually, keeping versions in sync, and coordinating changes across nodes requires repetitive work and deep NiFi knowledge. Datenschleuder automates this.

You define your NiFi topology once — servers, instances, clusters, and their hierarchy — and from that point on you deploy flows, manage versions, and run operations from the UI or via the remote agent, without ever touching NiFi directly.

---

## Highlights

### Automated Flow Deployment

Deploy NiFi Registry flows to one or more clusters in a single action. Datenschleuder resolves the correct process group paths, applies naming templates, and optionally starts or stops the flow after deployment. No more manual drag-and-drop in the NiFi canvas.

### Cluster Setup Wizard

The built-in wizard guides you through setting up a NiFi cluster from scratch: register servers, create NiFi instances, group them into a cluster, and assign hierarchy attributes. What normally takes hours of configuration is done in minutes.

### Hierarchy-Based Organization

Clusters and flows are organized by a configurable attribute hierarchy (e.g. `Organization → Org Unit → Common Name`). This maps directly to certificate subject attributes, making it easy to manage multi-tenant or multi-environment NiFi deployments.

### Datenschleuder Agent

The optional remote agent runs on each NiFi host and connects back via Redis Pub/Sub. Through the **Agents** section in the UI you can:

- Trigger git pulls on remote hosts
- Restart NiFi or ZooKeeper (Docker or bare-metal)
- View Docker stats and container health
- Run health checks without SSH access

### Flow Version Management

Browse all versions of a registered flow, compare metadata, and promote a specific version to a cluster. Version history is stored in the connected Git repository, giving you a full audit trail.

### Git-Backed Configuration

All flow configurations are stored in a Git repository of your choice. Datenschleuder manages cloning, pulling, and branching — credentials are stored securely and SSL verification is configurable per repository.

### RBAC and OIDC/SSO

Role-based access control lets you restrict who can deploy, configure, or view resources. OIDC support (Keycloak and others) means you can plug in your existing identity provider instead of managing local users.

---

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Python 3.9+, SQLAlchemy, Celery
- **Storage**: PostgreSQL, Redis
- **NiFi integration**: nipyapi (mutual TLS)

---

## Getting Started

1. **[INSTALL.md](INSTALL.md)** — Docker-based installation, environment configuration, and first login
2. **[SETUP.md](SETUP.md)** — Initial configuration: certificates, hierarchy, Git, clusters, and flow deployment

---

## License

See [LICENSE](LICENSE).
