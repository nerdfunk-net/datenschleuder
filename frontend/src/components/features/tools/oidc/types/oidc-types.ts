export interface ProviderDebugInfo {
  provider_id: string
  name: string
  enabled: boolean
  config: {
    client_id?: string
    authorization_endpoint?: string
    token_endpoint?: string
    userinfo_endpoint?: string
    jwks_uri?: string
    issuer?: string
    ca_cert_path?: string
    ca_cert_exists?: boolean
    scopes?: string[]
    response_type?: string
  }
  status: 'ok' | 'warning' | 'error'
  issues: string[]
}

export interface DebugResponse {
  oidc_enabled: boolean
  allow_traditional_login: boolean
  providers: ProviderDebugInfo[]
  global_config: {
    default_role?: string
    auto_create_users?: boolean
    update_user_info?: boolean
  }
  timestamp: string
}

export interface DebugLog {
  id: number
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  details?: Record<string, unknown>
}
