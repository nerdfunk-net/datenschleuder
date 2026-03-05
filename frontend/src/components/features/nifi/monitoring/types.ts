export interface NifiInstance {
  id: number
  hierarchy_attribute: string
  hierarchy_value: string
  nifi_url: string
  use_ssl: boolean
  verify_ssl: boolean
}

export interface Flow {
  id: number
  name?: string
  bucket_name: string
  registry_name: string
  version: number
  flow_id: string
  bucket_id: string
  src_connection_param?: string
  dest_connection_param?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface ProcessGroupStatus {
  status: string
  instance_id: number
  process_group_id: string
  detail: string
  data: ProcessGroupData
}

export interface VersionControlInformation {
  branch?: string
  bucket_id?: string
  bucket_name?: string
  flow_description?: string
  flow_id?: string
  flow_name?: string
  group_id?: string
  registry_id?: string
  registry_name?: string
  state?: string
  state_explanation?: string
  version?: string
}

export interface ParameterContextRef {
  id?: string
  permissions?: { can_read?: boolean; can_write?: boolean }
  component?: { id?: string; name?: string }
}

export interface ProcessGroupData {
  not_deployed?: boolean
  message?: string
  expected_path?: string
  running_count?: number
  stopped_count?: number
  invalid_count?: number
  disabled_count?: number
  stale_count?: number
  locally_modified_count?: number
  locally_modified_and_stale_count?: number
  sync_failure_count?: number
  up_to_date_count?: number
  input_port_count?: number
  output_port_count?: number
  local_input_port_count?: number
  local_output_port_count?: number
  public_input_port_count?: number
  public_output_port_count?: number
  active_remote_port_count?: number
  inactive_remote_port_count?: number
  versioned_flow_state?: string
  bulletins?: Bulletin[]
  status?: {
    aggregate_snapshot?: AggregateSnapshot
    name?: string
    stats_last_refreshed?: string
  }
  component?: {
    name?: string
    comments?: string
    running_count?: number
    stopped_count?: number
    invalid_count?: number
    disabled_count?: number
    stale_count?: number
    input_port_count?: number
    output_port_count?: number
    execution_engine?: string
    flowfile_concurrency?: string
    flowfile_outbound_policy?: string
    parameter_context?: ParameterContextRef
    parent_group_id?: string
    version_control_information?: VersionControlInformation
  }
  parameter_context?: ParameterContextRef
  uri?: string
}

export interface Bulletin {
  bulletin?: {
    source_name?: string
    message?: string
  }
}

export interface AggregateSnapshot {
  active_thread_count?: number
  flow_files_queued?: number
  queued?: string
  queued_count?: string | number
  input?: string
  output?: string
  read?: string
  written?: string
  transferred?: string
  received?: string
  bytes_in?: number
  bytes_out?: number
  bytes_queued?: number
  bytes_read?: number
  bytes_written?: number
  bytes_transferred?: number
  flow_files_in?: number
  flow_files_out?: number
  flow_files_transferred?: number
  flow_files_received?: number
  flow_files_sent?: number
}

export type FlowStatus = 'healthy' | 'unhealthy' | 'warning' | 'issues' | 'unknown'
export type FlowType = 'source' | 'destination'

// Instances monitoring types
export interface SystemDiagnosticsResponse {
  data: {
    system_diagnostics: {
      aggregate_snapshot: SystemSnapshot
    }
  }
}

export interface SystemSnapshot {
  heap_utilization?: string
  used_heap?: string
  max_heap?: string
  total_heap?: string
  free_heap?: string
  non_heap_utilization?: string
  used_non_heap?: string
  total_non_heap?: string
  processor_load_average?: number
  available_processors?: number
  total_threads?: number
  daemon_threads?: number
  uptime?: string
  stats_last_refreshed?: string
  version_info?: {
    ni_fi_version?: string
    build_tag?: string
    java_version?: string
    java_vendor?: string
    os_name?: string
    os_version?: string
    os_architecture?: string
  }
  content_repository_storage_usage?: StorageUsage[]
  flowfile_repository_storage_usage?: StorageUsage
  provenance_repository_storage_usage?: StorageUsage[]
  garbage_collection?: GarbageCollection[]
}

export interface StorageUsage {
  utilization?: string
  used_space?: string
  free_space?: string
  total_space?: string
}

export interface GarbageCollection {
  name?: string
  collection_count?: string | number
  collection_time?: string
}

// Queues monitoring types
export interface Connection {
  id: string
  name: string
  parent_group_id: string
  type: string | null
  comments: string | null
  source: {
    id: string
    name: string
    type: string
    group_id: string
  }
  destination: {
    id: string
    name: string
    type: string
    group_id: string
  }
  status: {
    aggregate_snapshot: {
      active_thread_count: number | null
      bytes_in: number
      bytes_out: number
      flow_files_in: number
      flow_files_out: number
      queued: string
    }
  }
}

// Deploy settings types
export interface DeploySettings {
  global: unknown
  paths: Record<
    string,
    {
      source_path: { id: string; path: string }
      dest_path: { id: string; path: string }
    }
  >
}

export interface HierarchyConfig {
  hierarchy: Array<{ name: string; label: string; order: number }>
}

export interface ProcessGroupPath {
  id: string
  name: string
  path: string
  level: number
  formatted_path: string
}

export interface AllPathsResponse {
  status: string
  process_groups: ProcessGroupPath[]
  count: number
  root_id: string
}
