export type CertType = 'server' | 'client' | 'user' | 'server+client'

export type RevocationReason =
  | 'unspecified'
  | 'keyCompromise'
  | 'affiliationChanged'
  | 'superseded'
  | 'cessationOfOperation'

export interface CAResponse {
  id: number
  common_name: string
  organization: string | null
  country: string | null
  state: string | null
  city: string | null
  org_unit: string | null
  email: string | null
  cert_pem: string
  serial_number: string
  key_size: number
  not_before: string
  not_after: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CertificateResponse {
  id: number
  ca_id: number
  common_name: string
  organization: string | null
  country: string | null
  state: string | null
  city: string | null
  org_unit: string | null
  email: string | null
  cert_type: CertType
  san_dns: string[] | null
  san_ip: string[] | null
  cert_pem: string
  serial_number: string
  key_size: number
  not_before: string
  not_after: string
  validity_days: number
  is_revoked: boolean
  revoked_at: string | null
  revocation_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CertificateListResponse {
  certificates: CertificateResponse[]
  total: number
}

export interface CreateCARequest {
  common_name: string
  organization?: string
  country?: string
  state?: string
  city?: string
  org_unit?: string
  email?: string
  validity_days?: number
  key_size?: 2048 | 4096
}

export interface TestNifiRequest {
  nifi_url: string
  verify_ssl?: boolean
  check_hostname?: boolean
}

export interface DiagnosticStep {
  step: number
  name: string
  status: 'success' | 'error' | 'warning' | 'skipped'
  message: string
  details: Record<string, unknown>
}

export interface TestNifiResponse {
  status: 'success' | 'error'
  steps: DiagnosticStep[]
  summary: {
    all_passed: boolean
    error_count: number
    warning_count: number
    nifi_version: string | null
  }
}

export interface CreateCertificateRequest {
  common_name: string
  organization?: string
  country?: string
  state?: string
  city?: string
  org_unit?: string
  email?: string
  cert_type?: CertType
  validity_days?: number
  key_size?: 2048 | 4096
  san_dns?: string
  san_ip?: string
}
