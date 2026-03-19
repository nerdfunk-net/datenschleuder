import type { JobTemplate, JobType, GitRepository, CommandTemplate, NifiCluster, ProcessGroup, HierarchyAttributeValues } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const EMPTY_TEMPLATES: JobTemplate[] = []
export const EMPTY_TYPES: JobType[] = []
export const EMPTY_REPOS: GitRepository[] = []
// EMPTY_INVENTORIES removed - inventory feature no longer exists
export const EMPTY_CMD_TEMPLATES: CommandTemplate[] = []
export const EMPTY_NIFI_CLUSTERS: NifiCluster[] = []
export const EMPTY_PROCESS_GROUPS: ProcessGroup[] = []
export const EMPTY_HIERARCHY_ATTRIBUTE_VALUES: HierarchyAttributeValues = {}
export const EMPTY_EXPORT_REPOS: GitRepository[] = []

export const JOB_TYPE_LABELS: Record<string, string> = {
  backup: 'Backup',
  compare_devices: 'Compare Devices',
  run_commands: 'Run Commands',
  sync_devices: 'Sync Devices',
  deploy_agent: 'Deploy Agent',
  check_queues: 'Check Queues',
  check_progress_group: 'Check ProcessGroup',
  export_flows: 'Export Flows',
} as const

export const JOB_TYPE_COLORS: Record<string, string> = {
  backup: 'bg-blue-500',
  compare_devices: 'bg-purple-500',
  run_commands: 'bg-green-500',
  sync_devices: 'bg-orange-500',
  deploy_agent: 'bg-teal-500',
  check_queues: 'bg-cyan-500',
  check_progress_group: 'bg-emerald-500',
  export_flows: 'bg-violet-500',
} as const

export const DEFAULT_TEMPLATE: Partial<JobTemplate> = {
  inventory_source: 'all',
  is_global: false,
  parallel_tasks: 1,
  activate_changes_after_sync: true,
} as const

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,          // 30 seconds - moderately dynamic
  JOB_TYPES: 5 * 60 * 1000,      // 5 minutes - rarely changes
  CONFIG_REPOS: 2 * 60 * 1000,   // 2 minutes - occasionally changes
  INVENTORIES: 30 * 1000,        // 30 seconds - moderately dynamic
  CMD_TEMPLATES: 2 * 60 * 1000,  // 2 minutes - occasionally changes
  EXPORT_REPOS: 2 * 60 * 1000,   // 2 minutes - occasionally changes
  HIERARCHY_ATTRIBUTE_VALUES: 30 * 1000, // 30 seconds - flows may be updated
} as const
