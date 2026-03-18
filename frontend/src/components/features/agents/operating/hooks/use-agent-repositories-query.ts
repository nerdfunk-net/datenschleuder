import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { AgentRepositoriesResponse } from '../types'

interface UseAgentRepositoriesQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseAgentRepositoriesQueryOptions = {}

export function useAgentRepositoriesQuery(
  agentId: string,
  options: UseAgentRepositoriesQueryOptions = DEFAULT_OPTIONS,
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.agents.repositories(agentId),
    queryFn: async () =>
      apiCall<AgentRepositoriesResponse>(`datenschleuder-agent/${agentId}/repositories`),
    enabled: enabled && !!agentId,
    staleTime: 60_000,
  })
}
