export interface WizardServer {
  tempId: string
  isExisting: boolean
  existingId?: number
  server_id: string
  hostname: string
  credential_id: number | null
  credential_name?: string | null
}

export interface WizardInstance {
  tempId: string
  name: string
  serverTempId: string
  nifi_url: string
  authMethod: 'username' | 'oidc' | 'certificate'
  username: string
  password: string
  oidcProvider: string
  certificateName: string
  use_ssl: boolean
  verify_ssl: boolean
  check_hostname: boolean
  git_config_repo_id: number
  git_repo_name?: string
}

export interface ClusterConfig {
  cluster_id: string
  hierarchy_attribute: string
  hierarchy_value: string
  primaryInstanceTempId: string
}

export interface CertificateConfig {
  instanceTempId: string
  instanceName: string
  certSubject: string
  keystoreExists: boolean | null
  truststoreExists: boolean | null
  keystorePassword: string
  truststorePassword: string
}

export interface ZookeeperNode {
  instanceTempId: string
  hostname: string
}

export interface ZookeeperConfig {
  nodes: ZookeeperNode[]
  quorumPort: number
  leaderElectionPort: number
  clientPort: number
}

export interface BootstrapWizardConfig {
  runAs: string
  minRam: string
  maxRam: string
  preserveEnvironment: boolean
}

export type DeployStatus = 'idle' | 'deploying' | 'success' | 'error'

export interface DeployProgress {
  currentStep: string
  completedSteps: string[]
  error?: string
}
