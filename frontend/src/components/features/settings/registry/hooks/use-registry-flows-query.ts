import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { RegistryFlow } from '../types'

interface UseRegistryFlowsQueryOptions {
  clusterId?: number
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseRegistryFlowsQueryOptions = {}

export function useRegistryFlowsQuery(options: UseRegistryFlowsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { clusterId, enabled = true } = options

  return useQuery<RegistryFlow[]>({
    queryKey: queryKeys.registryFlows.list(clusterId),
    queryFn: () => {
      const url = clusterId !== undefined
        ? `nifi/registry-flows/?cluster_id=${clusterId}`
        : 'nifi/registry-flows/'
      return apiCall(url)
    },
    enabled,
    staleTime: 30 * 1000,
  })
}
