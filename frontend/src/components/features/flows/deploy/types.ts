export interface DeploymentConfig {
  key: string // `${flowId}-${target}`
  flowId: number
  flowName: string
  target: 'source' | 'destination'
  hierarchyValue: string // Top hierarchy (e.g., "DC_A")
  instanceId: number | null // NiFi instance ID
  availablePaths: ProcessGroupPath[]
  selectedProcessGroupId: string
  suggestedPath: string | null // Hint text
  templateId: number | null
  templateName: string | null
  processGroupName: string // Generated from template
  parameterContextName: string | null
  availableVersions: FlowVersion[]
  selectedVersion: number | null // null = latest
  registryId: string | null
  bucketId: string | null
  flowIdRegistry: string | null
}

export interface ProcessGroupPath {
  id: string
  name: string
  path: string
  level: number
  formatted_path: string // Readable path with arrows
}

export interface FlowVersion {
  version: number
  timestamp: string
  comments?: string
}

export interface DeploymentSettings {
  global: {
    process_group_name_template: string // Default: "{last_hierarchy_value}"
    disable_after_deploy: boolean // Lock PG after deploy
    stop_versioning_after_deploy: boolean // Stop version control
    start_after_deploy: boolean // Start PG (default: stopped)
  }
  paths: Record<
    string,
    {
      source_path?: string
      dest_path?: string
    }
  > // Key is instanceId as string
}

export interface DeploymentRequest {
  template_id: number | null
  parent_process_group_id: string
  process_group_name: string
  version: number | null // null = latest
  x_position: number // 0
  y_position: number // 0
  stop_versioning_after_deploy: boolean
  disable_after_deploy: boolean
  start_after_deploy: boolean
  hierarchy_attribute?: string
  parameter_context_name?: string | null
}

export interface DeploymentResponse {
  status: string
  message: string
  process_group_id?: string
  process_group_name?: string
  instance_id: number
  bucket_id: string
  flow_id: string
  version?: number | string
}

export interface ConflictInfo {
  message: string
  existing_process_group: {
    id: string
    name: string
    running_count: number
    stopped_count: number
    has_version_control: boolean
  }
}

export interface ConflictDeployment {
  config: DeploymentConfig
  conflictInfo: ConflictInfo
}

export interface DeploymentResult {
  config: DeploymentConfig
  success: boolean
  response?: DeploymentResponse
  error?: string
}

export interface DeploymentResults {
  successful: DeploymentResult[]
  failed: DeploymentResult[]
  total: number
  successCount: number
  failureCount: number
}

export interface RegistryFlow {
  id: number
  nifi_flow_id: number
  registry_id: string
  bucket_id: string
  flow_id: string
  flow_name: string
  created_at: string
  updated_at: string
}

export interface HierarchyAttribute {
  name: string
  label: string
  order: number
}

export interface NifiInstance {
  id: number
  name: string
  url: string
  hierarchy_attribute: string
  hierarchy_value: string
  is_active: boolean
  verify_ssl: boolean
  created_at: string
  updated_at: string
}

// Steps
export const STEPS = [
  { id: 1, title: 'Select Flows', description: 'Choose flows to deploy' },
  { id: 2, title: 'Choose Targets', description: 'Select deployment direction' },
  { id: 3, title: 'Process Groups', description: 'Select target locations' },
  { id: 4, title: 'Settings', description: 'Configure deployment options' },
  { id: 5, title: 'Review & Deploy', description: 'Review and execute' },
] as const

export type Step = (typeof STEPS)[number]
