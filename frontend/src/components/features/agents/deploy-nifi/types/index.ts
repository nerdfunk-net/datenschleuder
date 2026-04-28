export type NifiProperties = Record<string, string>

export interface DeployNifiState {
  currentStep: number
  // Step 1
  selectedAgentId: string | null
  selectedGitRepoId: number | null
  selectedGitRepoUrl: string | null
  selectedGitRepoBranch: string
  selectedGitRepoName: string | null
  selectedCredentialId: number | null
  selectedCredentialName: string | null
  // Step 2
  targetDirectory: string
  properties: NifiProperties
  // Step 3
  composeContent: string
  // Step 4
  createDirectories: boolean
  deployStatus: 'idle' | 'deploying' | 'success' | 'error'
  deployResult: string | null
  deployError: string | null
}

export interface DeployNifiPayload {
  target_directory: string
  compose_content: string
  create_directories: boolean
  volume_dirs: Record<string, string>
  conf_dir: string | null
  git_repo_url: string | null
  git_branch: string
  credential_id: number | null
}

export interface PropertyGroup {
  title: string
  properties: string[]
}
