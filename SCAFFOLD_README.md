# Cockpit-NG Scaffold - What's Included

This document describes what remains in the scaffold after removing domain-specific features.

## ✅ Included Features

### Authentication & Authorization
- **JWT Authentication**: Token-based auth with login/logout
- **OIDC/SSO**: Multi-provider support (Keycloak, Azure AD, Okta)
- **RBAC System**: Complete user/role/permission framework
  - Users table with encrypted passwords
  - Roles with flexible permission assignments
  - Permission format: `resource:action` (e.g., `users:write`)
  - User profiles with metadata
- **Auth Routes**: `/auth/login`, `/auth/logout`, `/profile`

### Job Orchestration System
- **Job Templates**: Reusable job definitions with parameters
- **Job Scheduler**: Cron-based scheduling (Celery Beat)
- **Job Execution**: Background execution via Celery workers
- **Job Monitoring**: Real-time status tracking, logs, results
- **Job History**: Complete audit trail of executions
- **Routes**: `/jobs/templates`, `/jobs/schedules`, `/jobs/runs`, `/jobs/celery-status`

### Git & Template Management
- **Git Repositories**: Connect to Git repos for version control
- **Template Engine**: Jinja2 templates with variable substitution
- **Template Versioning**: Track versions via Git commits
- **Branch Management**: Switch between branches, view commits
- **Cache System**: Redis-based caching of Git data
- **Routes**: `/settings/git`, `/settings/templates`

### Settings Management
- **Git Settings**: Repository configuration
- **Cache Settings**: Redis cache configuration and statistics
- **Celery Settings**: Queue management and worker configuration
- **Credentials**: Encrypted credential storage
- **RBAC Settings**: User, role, permission management
- **Routes**: `/settings/*`

### Frontend UI
- **Dashboard**: Home page with system overview
- **Jobs Pages**: Template management, scheduler, job viewer
- **Settings Pages**: All configuration interfaces
- **Profile Page**: User profile management
- **Modern UI**: Shadcn UI components with Tailwind CSS
- **Responsive Design**: Mobile-first layout

### Infrastructure
- **PostgreSQL Database**: 21 tables remaining (from 40 original)
- **Redis**: Caching and Celery message broker
- **Celery**: 4 built-in queues (default, backup, network, heavy)
- **Docker**: Multi-container deployment
- **FastAPI**: REST API with automatic OpenAPI docs
- **Next.js**: Server-side rendering, App Router

## Database Schema

### Core Tables (21 preserved)
1. `users` - User accounts
2. `user_profiles` - Extended user information
3. `roles` - Role definitions
4. `permissions` - Permission definitions
5. `role_permissions` - Role-permission mappings
6. `user_roles` - User-role assignments
7. `user_permissions` - Direct user permissions
8. `settings` - General settings
9. `settings_metadata` - Configuration metadata
10. `credentials` - Encrypted credentials
11. `git_repositories` - Git repo connections
12. `git_settings` - Git configuration
13. `cache_settings` - Cache configuration
14. `celery_settings` - Celery configuration
15. `job_templates` - Job definitions
16. `job_schedules` - Job schedules
17. `job_runs` - Job execution history
18. `templates` - Template definitions
19. `template_versions` - Template version history
20. `audit_logs` - Activity tracking
21. `celery_jobs` - Celery task tracking

## ❌ Removed Features

### Domain-Specific Features (70%+ reduction)
- ❌ Nautobot integration (device management)
- ❌ CheckMK integration (monitoring)
- ❌ Network automation (Netmiko, device configs)
- ❌ Compliance checking
- ❌ Inventory management
- ❌ Agent deployment (TIG stack, Cockpit agents)
- ❌ Backup management (snapshots, configs)
- ❌ Tools (CSV updates, IP checking, prefix scanning)

### Removed Database Tables (19 deleted)
- NB2CMKSync, NB2CMKJob, NB2CMKJobResult
- ComplianceRule, ComplianceCheck, RegexPattern
- LoginCredential, SNMPMapping
- NautobotSetting, CheckMKSetting, AgentsSetting
- NautobotDefault, DeviceOffboardingSetting
- Inventory
- Snapshot, SnapshotCommand, SnapshotCommandTemplate, SnapshotResult
- CockpitAgentCommand

### Removed Backend Modules
- `routers/nautobot/`, `routers/checkmk/`, `routers/network/`
- `routers/inventory/`, `routers/agents/`, `routers/compliance_check.py`
- `routers/tools.py`, `routers/cockpit_agent.py`
- `routers/settings/compliance/`, `routers/settings/connections/`
- `services/nautobot/`, `services/checkmk/`, `services/network/`
- `services/inventory/`, `services/agents/`, `services/cockpit_agent_service.py`
- `repositories/compliance/`, `repositories/inventory/`, `repositories/backup_repository.py`
- `models/nautobot.py`, `models/checkmk.py`, `models/snapshots.py`, `models/backup_models.py`, `models/inventory.py`, `models/cockpit_agent.py`
- 11 task files from `tasks/`

### Removed Frontend Modules
- 27+ page directories from `app/(dashboard)/`
- 6 feature component directories
- 2 settings subdirectories
- 9 query hook files

### Removed Configuration Files
- `config/checkmk.yaml`, `config/checkmk_queries.yaml`
- `config/snmp_mapping.yaml`
- `config.example/tig/`

## Code Metrics

### Backend Reduction
- **core/models.py**: 1377 → 798 lines (42% reduction)
- **settings_manager.py**: 1081 → 647 lines (40% reduction)
- **main.py**: ~474 → ~250 lines (reduced router imports)
- **Routers**: ~30 → ~12 remaining
- **Repository imports**: Cleaned compliance references

### Frontend Reduction
- **Sidebar navigation**: 7 sections → 3 sections
- **query-keys.ts**: 328 → ~175 lines (removed 11 key factories)
- **Pages removed**: 27+ directories
- **Components removed**: 6 feature directories
- **Query hooks removed**: 9 files

## Getting Started with the Scaffold

### 1. Set Up Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env - set SECRET_KEY, database credentials, Redis password

# Frontend
cd frontend
npm install
```

### 2. Start Services

```bash
# Docker (recommended)
cd docker
docker compose up -d

# Or manually:
# PostgreSQL + Redis must be running
cd backend
COCKPIT_REDIS_PASSWORD=changeme python start.py

# In another terminal:
cd frontend
npm run dev
```

### 3. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- Default login: admin/admin

### 4. Build Your Application

Follow these steps to add your domain logic:

1. **Define database models** in `backend/core/models.py`
2. **Create Pydantic models** in `backend/models/{domain}.py`
3. **Add repository** in `backend/repositories/{domain}_repository.py`
4. **Add service** in `backend/services/{domain}_service.py`
5. **Add router** in `backend/routers/{domain}.py`
6. **Register router** in `backend/main.py`
7. **Create frontend pages** in `frontend/src/app/(dashboard)/{feature}/`
8. **Add query hooks** in `frontend/src/hooks/queries/`
9. **Update sidebar** in `frontend/src/components/layout/app-sidebar.tsx`

See [CLAUDE.md](CLAUDE.md) for detailed architecture guidelines.

## Key Files to Review

### Backend
- `backend/core/models.py` - Database schema (21 tables)
- `backend/main.py` - FastAPI app and router registration
- `backend/core/auth.py` - Authentication/authorization logic
- `backend/settings_manager.py` - Settings management
- `backend/celery_app.py` - Celery configuration

### Frontend
- `frontend/src/components/layout/app-sidebar.tsx` - Navigation
- `frontend/src/lib/query-keys.ts` - TanStack Query keys
- `frontend/src/lib/auth-store.ts` - Authentication state
- `frontend/src/app/(dashboard)/` - All pages

## Notes

- **Redis password required**: Set `COCKPIT_REDIS_PASSWORD=changeme` in environment
- **PostgreSQL required**: SQLite support removed
- **Migration system**: Use `backend/migrations/` for schema changes
- **OIDC configured**: via `config/oidc_providers.yaml`
- **Job queues**: 4 built-in queues ready for use
- **Template system**: Jinja2 engine ready for custom templates

## Testing

```bash
# Backend imports (requires Redis running)
cd backend
COCKPIT_REDIS_PASSWORD=changeme python -c "import main; print('✅ Success')"

# Frontend build (requires npm install first)
cd frontend
npm install
npm run build
```

## Questions?

See [CLAUDE.md](CLAUDE.md) for complete technical documentation and architectural patterns.
