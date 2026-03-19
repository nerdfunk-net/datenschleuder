export interface FlowImportRequest {
  repo_id: number
  file_path: string
  dry_run: boolean
}

export interface FlowImportResultItem {
  row_index: number
  status: 'created' | 'skipped' | 'error'
  message: string
  flow_data?: Record<string, unknown> | null
}

export interface FlowImportResponse {
  dry_run: boolean
  total: number
  created: number
  skipped: number
  errors: number
  results: FlowImportResultItem[]
}

export interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  is_active: boolean
  sync_status?: string | null
}

export interface GitTreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
}
