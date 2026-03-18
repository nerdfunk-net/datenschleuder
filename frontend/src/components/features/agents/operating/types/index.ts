export interface CockpitAgent {
  agent_id: string
  status: string // 'online' | 'offline'
  last_heartbeat: number // unix timestamp
  version: string
  hostname: string
  capabilities: string // comma-separated
  started_at: number // unix timestamp
  commands_executed: number
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

export interface CommandResult {
  command_id: string
  status: string
  output: string | null
  error: string | null
  execution_time_ms: number
  parsed_output?: DockerPsRow[] | DockerStatsRow[] | null
}
