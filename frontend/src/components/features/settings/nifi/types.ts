export interface NifiInstance {
  id: number
  name: string | null
  hierarchy_attribute: string | null
  hierarchy_value: string | null
  server_id: number | null
  nifi_url: string
  username: string | null
  use_ssl: boolean
  verify_ssl: boolean
  certificate_name: string | null
  check_hostname: boolean
  oidc_provider_id: string | null
  git_config_repo_id: number | null
  created_at: string
  updated_at: string
}

export interface NifiServer {
  id: number
  server_id: string
  hostname: string
  credential_id: number | null
  credential_name: string | null
  created_at: string
  updated_at: string
}

export interface NifiClusterMember {
  instance_id: number
  name: string | null
  nifi_url: string
  is_primary: boolean
}

export interface NifiCluster {
  id: number
  cluster_id: string
  hierarchy_attribute: string
  hierarchy_value: string
  members: NifiClusterMember[]
  created_at: string
  updated_at: string
}

export interface HierarchyAttribute {
  name: string
  label: string
  values?: string[]
}

export interface OidcProvider {
  provider_id: string
  name: string
}

export interface Certificate {
  name: string
}

export type AuthMethod = 'username' | 'oidc' | `cert:${string}`

export interface NifiInstanceFormValues {
  name: string
  server_id: string
  nifi_url: string
  authMethod: AuthMethod
  username: string
  password: string
  oidcProvider: string
  use_ssl: boolean
  verify_ssl: boolean
  check_hostname: boolean
  git_config_repo_id: string
}

export interface TestConnectionResult {
  status: 'success' | 'error'
  message: string
  details: {
    version?: string
    connected?: boolean
    error?: string
    nifi_url?: string
  }
}
