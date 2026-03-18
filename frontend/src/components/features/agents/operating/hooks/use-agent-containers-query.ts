import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { AgentContainersResponse } from '../types'

interface UseAgentContainersQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseAgentContainersQueryOptions = {}

export function useAgentContainersQuery(
  agentId: string,
  options: UseAgentContainersQueryOptions = DEFAULT_OPTIONS,
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.agents.containers(agentId),
    queryFn: async () =>
      apiCall<AgentContainersResponse>(`datenschleuder-agent/${agentId}/containers`),
    enabled: enabled && !!agentId,
    staleTime: 60_000,
  })
}
