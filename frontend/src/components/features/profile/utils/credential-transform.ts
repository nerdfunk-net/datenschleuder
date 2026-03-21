import type { PersonalCredential } from '../types/profile-types'
import type { ProfileServerCredential } from '../hooks/queries/use-profile-query'
import type { ProfileUpdatePayload } from '../hooks/queries/use-profile-mutations'

export function generateCredentialId(): string {
  return `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function mapServerCredential(cred: ProfileServerCredential): PersonalCredential {
  const hasStoredPassword = cred.id && /^\d+$/.test(cred.id)
  const isPasswordToken = cred.password && /^•+$/.test(cred.password)
  const credType = cred.type.toUpperCase() as PersonalCredential['type']
  return {
    id: cred.id,
    name: cred.name,
    username: cred.username,
    type: credType,
    password: isPasswordToken ? (cred.password ?? '') : (cred.password || ''),
    isOpen: false,
    showPassword: false,
    hasStoredPassword: !!hasStoredPassword,
    passwordChanged: false,
    has_ssh_key: cred.has_ssh_key || false,
    ssh_private_key: '',
    ssh_passphrase: '',
    showSshPassphrase: false,
    sshKeyChanged: false,
  }
}

export function buildCredentialPayload(
  cred: PersonalCredential,
): ProfileUpdatePayload['personal_credentials'][0] {
  const base = {
    id: cred.id,
    name: cred.name,
    username: cred.username,
    type: cred.type,
    password: '',
  }
  if (cred.type === 'SSH_KEY') {
    return {
      ...base,
      ssh_private_key: cred.sshKeyChanged ? (cred.ssh_private_key || '') : '',
      ssh_passphrase: cred.sshKeyChanged ? (cred.ssh_passphrase || '') : '',
    }
  }
  return {
    ...base,
    password:
      (cred.passwordChanged || !cred.hasStoredPassword) && !/^•+$/.test(cred.password)
        ? cred.password
        : '',
  }
}
