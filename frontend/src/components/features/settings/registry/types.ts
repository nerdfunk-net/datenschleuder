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

export interface RegistryClient {
  id: string
  name: string
}

export interface Bucket {
  identifier: string
  name: string
  description?: string
}

export interface RemoteFlow {
  identifier: string
  name: string
  description?: string
  bucketIdentifier?: string
  bucketName?: string
}

export interface FlowVersion {
  version: number
  author: string
  timestamp: number | null
  comments?: string
}

export interface RegistryDetails {
  is_github?: boolean
  github_url?: string
  type?: string
}

export interface FlowMetadataItem {
  _clientKey: string
  key: string
  value: string
  is_mandatory: boolean
}

export interface FlowMetadataResponse {
  id: number
  registry_flow_id: number
  key: string
  value: string
  is_mandatory: boolean
  created_at: string
  updated_at: string
}
