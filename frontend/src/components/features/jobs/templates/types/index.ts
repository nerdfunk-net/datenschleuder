export interface DeployTemplateEntry {
  template_id: number
  inventory_id: number | null
  path: string
  custom_variables: Record<string, string>
}

export interface NifiInstance {
  id: number
  name: string | null
  nifi_url: string
  hierarchy_attribute: string
  hierarchy_value: string
}

export interface ProcessGroup {
  id: string
  name: string
  path: string
  level: number
  formatted_path: string
}

export interface JobTemplate {
  id: number
  name: string
  job_type: string
  description?: string
  config_repository_id?: number
  inventory_source: "all" | "inventory"
  inventory_repository_id?: number
  inventory_name?: string
  command_template_name?: string
  backup_running_config_path?: string
  backup_startup_config_path?: string
  write_timestamp_to_custom_field?: boolean
  timestamp_custom_field_name?: string
  activate_changes_after_sync?: boolean
  parallel_tasks?: number
  deploy_template_id?: number
  deploy_agent_id?: string
  deploy_path?: string
  deploy_custom_variables?: Record<string, string>
  activate_after_deploy?: boolean
  deploy_templates?: DeployTemplateEntry[]
  nifi_instance_ids?: number[] | null
  check_queues_mode?: 'count' | 'bytes' | 'both'
  check_queues_count_yellow?: number
  check_queues_count_red?: number
  check_queues_bytes_yellow?: number
  check_queues_bytes_red?: number
  check_progress_group_nifi_instance_id?: number | null
  check_progress_group_process_group_id?: string | null
  check_progress_group_process_group_path?: string | null
  check_progress_group_check_children?: boolean
  check_progress_group_expected_status?: 'Running' | 'Stopped' | 'Enabled' | 'Disabled'
  is_global: boolean
  user_id?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface JobType {
  value: string
  label: string
  description: string
}

export interface GitRepository {
  id: number
  name: string
  url: string
  branch: string
  category: string
}

export interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
}

export interface CommandTemplate {
  id: number
  name: string
  category: string
}
