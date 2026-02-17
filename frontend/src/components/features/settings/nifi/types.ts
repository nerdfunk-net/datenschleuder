export interface NifiInstance {
  id: number
  name: string | null
  hierarchy_attribute: string
  hierarchy_value: string
  nifi_url: string
  username: string | null
  use_ssl: boolean
  verify_ssl: boolean
  certificate_name: string | null
  check_hostname: boolean
  oidc_provider_id: string | null
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
  hierarchy_attribute: string
  hierarchy_value: string
  nifi_url: string
  authMethod: AuthMethod
  username: string
  password: string
  oidcProvider: string
  use_ssl: boolean
  verify_ssl: boolean
  check_hostname: boolean
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
