export interface PersonalCredential {
  id: string
  name: string
  username: string
  type: 'SSH' | 'SSH_KEY' | 'TACACS' | 'Generic' | 'Token'
  password: string
  isOpen: boolean
  showPassword: boolean
  hasStoredPassword: boolean
  passwordChanged: boolean
  ssh_private_key?: string
  ssh_passphrase?: string
  has_ssh_key?: boolean
  showSshPassphrase?: boolean
  sshKeyChanged?: boolean
}

export interface ProfileData {
  username: string
  realname: string
  email: string
  api_key: string
  personal_credentials: PersonalCredential[]
}
