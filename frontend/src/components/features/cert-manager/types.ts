export interface CertFileInfo {
  path: string
  name: string
  file_type: 'pem' | 'p12'
  size: number | null
}

export interface CertFileListResponse {
  instance_id: number
  files: CertFileInfo[]
}

export interface CertificateInfo {
  index: number
  subject: string
  issuer: string
  serial: string
  not_before: string
  not_after: string
  is_expired: boolean
  san: string[]
  key_usage: string[]
  signature_algorithm: string
  fingerprint_sha256: string
  raw_text: string
  has_private_key: boolean
}

export interface FileCertificatesResponse {
  file_path: string
  file_type: string
  certificates: CertificateInfo[]
}

export interface ConvertRequest {
  instance_id: number
  file_path: string
  target_format: 'pem' | 'p12'
  output_filename: string
  password?: string
}

export interface ConvertResponse {
  success: boolean
  message: string
  output_path: string
  commit_sha: string | null
}

export interface ExportRequest {
  instance_id: number
  file_path: string
  cert_indices: number[]
  format: 'pem' | 'der' | 'p12'
  password?: string
}

export interface CreateKeystoreRequest {
  instance_id: number
  filename: string
  password: string
  subject_cn: string
  subject_ou?: string
  subject_o?: string
  subject_c?: string
  validity_days: number
  key_size: number
}

export interface CreateTruststoreRequest {
  instance_id: number
  filename: string
  subject_cn: string
  subject_ou?: string
  subject_o?: string
  subject_c?: string
  validity_days: number
}

export interface KeystoreCreateResponse {
  success: boolean
  message: string
  output_path: string
  commit_sha: string | null
}

export interface NifiPasswordEntry {
  key: string
  value: string
}

export interface NifiPasswordsResponse {
  instance_id: number
  file_path: string
  passwords: NifiPasswordEntry[]
}
