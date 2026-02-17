export interface PathConfig {
  id: string   // UUID of the process group
  path: string // Human-readable path, e.g. "Nifi Flow/From DC1"
}

export interface DeploymentSettings {
  global: {
    process_group_name_template: string
    disable_after_deploy: boolean
    start_after_deploy: boolean
    stop_versioning_after_deploy: boolean
  }
  paths: {
    [instanceId: number]: {
      source_path?: PathConfig
      dest_path?: PathConfig
    }
  }
}

export interface ProcessGroupOption {
  id: string
  name: string
  path: string // reversed breadcrumb, e.g. "Root / Child / Grandchild"
}

const DEFAULT_GLOBAL = {
  process_group_name_template: '{last_hierarchy_value}',
  disable_after_deploy: false,
  start_after_deploy: true,
  stop_versioning_after_deploy: false,
}

export { DEFAULT_GLOBAL }
