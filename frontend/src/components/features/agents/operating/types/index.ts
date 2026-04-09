export interface Capability {
  id: string
  name: string
  description?: string
}

export interface CockpitAgent {
  agent_id: string
  status: string // 'online' | 'offline'
  last_heartbeat: number // unix timestamp
  version: string
  hostname: string
  capabilities: string // JSON array of Capability objects
  started_at: number // unix timestamp
  commands_executed: number
  redis_server_id: number | null
  redis_server_name: string | null
}

export interface AgentListResponse {
  agents: CockpitAgent[]
}

export interface CommandHistoryItem {
  id: number
  agent_id: string
  command_id: string
  command: string
  params: string | null // JSON string
  status: string | null
  output: string | null
  error: string | null
  execution_time_ms: number | null
  sent_at: string // ISO datetime
  completed_at: string | null // ISO datetime
  sent_by: string | null
  redis_server_id: number | null
}

export interface CommandHistoryResponse {
  commands: CommandHistoryItem[]
  total: number
}

export interface GitPullInput {
  agent_id: string
}

export interface DockerRestartInput {
  agent_id: string
}

export interface DockerPsRow {
  container_id: string
  image: string
  command: string
  created: string
  status: string
  ports: string
  names: string
}

export interface DockerStatsRow {
  container_id: string
  name: string
  cpu_percent: string
  mem_usage: string
  mem_limit: string
  mem_percent: string
  net_io_rx: string
  net_io_tx: string
  block_io_read: string
  block_io_write: string
  pids: string
}

export interface GitRepoInfo {
  id: string
}

export interface AgentRepositoriesResponse {
  agent_id: string
  repositories: GitRepoInfo[]
}

export interface ContainerInfo {
  id: string
  type: string
}

export interface AgentContainersResponse {
  agent_id: string
  containers: ContainerInfo[]
}

export interface ContainerListRow {
  id: string
  type: string
}

export interface RepositoryListRow {
  id: string
}

export interface GitStatusRow {
  repo: string
  branch: string
  file: string   // empty string when status === 'clean'
  status: string // 'clean' | 'modified' | 'staged' | 'staged+modified' | 'untracked' | 'deleted' | 'staged deleted' | 'added' | 'added+modified' | 'renamed' | 'conflict'
}

export interface NifiFetchRow {
  repo: string
  branch: string
  was_modified: boolean
}

export interface CommandResult {
  command_id: string
  status: string
  output: string | null
  error: string | null
  execution_time_ms: number
  parsed_output?: DockerPsRow[] | DockerStatsRow[] | ContainerListRow[] | RepositoryListRow[] | GitStatusRow[] | NifiFetchRow[] | null
}
