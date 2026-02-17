// Query key factory pattern
// Hierarchical structure enables targeted cache invalidation

export const queryKeys = {
  // Git Repositories
  git: {
    all: ['git'] as const,
    repositories: () => [...queryKeys.git.all, 'repositories'] as const,
    repository: (id: number) => [...queryKeys.git.all, 'repository', id] as const,
    status: (id: number) => [...queryKeys.git.repository(id), 'status'] as const,
  },

  // Celery Jobs
  jobs: {
    all: ['jobs'] as const,

    // List with all filter combinations
    list: (params?: {
      page?: number
      page_size?: number
      status?: string | string[]
      job_type?: string | string[]
      triggered_by?: string | string[]
      template_id?: string | string[]
    }) =>
      params
        ? ([...queryKeys.jobs.all, 'list', params] as const)
        : ([...queryKeys.jobs.all, 'list'] as const),

    // Individual job detail
    detail: (id: number | string) => [...queryKeys.jobs.all, 'detail', id] as const,

    // Progress endpoint
    progress: (id: number) => [...queryKeys.jobs.all, 'progress', id] as const,

    // Templates
    templates: () => [...queryKeys.jobs.all, 'templates'] as const,
    template: (id: number) => [...queryKeys.jobs.templates(), id] as const,

    // Template dependencies
    jobTypes: () => [...queryKeys.jobs.all, 'job-types'] as const,
    configRepos: (category?: string) =>
      category
        ? ([...queryKeys.jobs.all, 'config-repos', category] as const)
        : ([...queryKeys.jobs.all, 'config-repos'] as const),
    // savedInventories removed - inventory feature no longer exists
    commandTemplates: () => [...queryKeys.jobs.all, 'command-templates'] as const,
    customFields: (contentType?: string) =>
      contentType
        ? ([...queryKeys.jobs.all, 'custom-fields', contentType] as const)
        : ([...queryKeys.jobs.all, 'custom-fields'] as const),

    // Schedules
    schedules: () => [...queryKeys.jobs.all, 'schedules'] as const,
    schedule: (id: number) => [...queryKeys.jobs.schedules(), id] as const,

    // Scheduler debug
    schedulerDebug: () => [...queryKeys.jobs.all, 'scheduler-debug'] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    credentials: () => [...queryKeys.settings.all, 'credentials'] as const,
    git: () => [...queryKeys.settings.all, 'git'] as const,
    celery: () => [...queryKeys.settings.all, 'celery'] as const,
  },

  // Common Settings
  commonSettings: {
    all: ['commonSettings'] as const,
    snmpMapping: () => [...queryKeys.commonSettings.all, 'snmpMapping'] as const,
  },

  // Celery
  celery: {
    all: ['celery'] as const,

    // Status
    status: () => [...queryKeys.celery.all, 'status'] as const,

    // Settings
    settings: () => [...queryKeys.celery.all, 'settings'] as const,

    // Workers
    workers: () => [...queryKeys.celery.all, 'workers'] as const,

    // Schedules
    schedules: () => [...queryKeys.celery.all, 'schedules'] as const,

    // Queues
    queues: () => [...queryKeys.celery.all, 'queues'] as const,

    // Task status
    task: (taskId: string) => [...queryKeys.celery.all, 'task', taskId] as const,
  },

  // Cache
  cache: {
    all: ['cache'] as const,

    // Settings
    settings: () => [...queryKeys.cache.all, 'settings'] as const,

    // Statistics
    stats: () => [...queryKeys.cache.all, 'stats'] as const,

    // Entries
    entries: (includeExpired?: boolean) =>
      includeExpired
        ? ([...queryKeys.cache.all, 'entries', { includeExpired }] as const)
        : ([...queryKeys.cache.all, 'entries'] as const),

    // Namespace
    namespace: (namespace: string) => [...queryKeys.cache.all, 'namespace', namespace] as const,
  },

  // Credentials
  credentials: {
    all: ['credentials'] as const,
    list: (filters?: { source?: string; includeExpired?: boolean; git?: boolean }) =>
      filters
        ? ([...queryKeys.credentials.all, 'list', filters] as const)
        : ([...queryKeys.credentials.all, 'list'] as const),
    detail: (id: number) => [...queryKeys.credentials.all, 'detail', id] as const,
  },

  // RBAC (Role-Based Access Control)
  rbac: {
    all: ['rbac'] as const,

    // Users
    users: () => [...queryKeys.rbac.all, 'users'] as const,
    user: (id: number) => [...queryKeys.rbac.all, 'user', id] as const,
    userRoles: (userId: number) => [...queryKeys.rbac.all, 'user', userId, 'roles'] as const,
    userPermissions: (userId: number) => [...queryKeys.rbac.all, 'user', userId, 'permissions'] as const,

    // Roles
    roles: () => [...queryKeys.rbac.all, 'roles'] as const,
    role: (id: number) => [...queryKeys.rbac.all, 'role', id] as const,
    rolePermissions: (roleId: number) => [...queryKeys.rbac.all, 'role', roleId, 'permissions'] as const,

    // Permissions
    permissions: () => [...queryKeys.rbac.all, 'permissions'] as const,
  },

  // Templates
  templates: {
    all: ['templates'] as const,

    // Templates list
    list: (filters?: { category?: string; source?: string; search?: string }) =>
      filters
        ? ([...queryKeys.templates.all, 'list', filters] as const)
        : ([...queryKeys.templates.all, 'list'] as const),

    // Single template
    detail: (id: number) => [...queryKeys.templates.all, 'detail', id] as const,

    // Template content
    content: (id: number) => [...queryKeys.templates.all, 'content', id] as const,

    // Categories
    categories: () => [...queryKeys.templates.all, 'categories'] as const,

    // Importable templates
    importable: () => [...queryKeys.templates.all, 'importable'] as const,
  },
}
