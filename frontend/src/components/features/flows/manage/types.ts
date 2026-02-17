export interface NifiFlow {
  id: number
  hierarchy_values: Record<string, { source: string; destination: string }>
  name: string | null
  contact: string | null
  src_connection_param: string
  dest_connection_param: string
  src_template_id: number | null
  dest_template_id: number | null
  active: boolean
  description: string | null
  creator_name: string | null
  created_at: string
  updated_at: string
}

export interface FlowView {
  id: number
  name: string
  description: string | null
  visible_columns: string[]
  column_widths: Record<string, number> | null
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RegistryFlow {
  id: number
  nifi_instance_id: number
  nifi_instance_name: string
  nifi_instance_url: string
  registry_id: string
  registry_name: string
  bucket_id: string
  bucket_name: string
  flow_id: string
  flow_name: string
  flow_description: string | null
  created_at: string
  updated_at: string
}

export interface FlowColumn {
  key: string
  label: string
}

export interface FlowFormValues {
  hierarchy_values: Record<string, { source: string; destination: string }>
  name: string
  contact: string
  src_connection_param: string
  dest_connection_param: string
  src_template_id: string
  dest_template_id: string
  active: boolean
  description: string
}
