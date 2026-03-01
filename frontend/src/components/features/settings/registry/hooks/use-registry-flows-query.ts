import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { RegistryFlow } from '../types'

export function useRegistryFlowsQuery(clusterId?: number) {
  const { apiCall } = useApi()

  return useQuery<RegistryFlow[]>({
    queryKey: queryKeys.registryFlows.list(clusterId),
    queryFn: () => {
      const url = clusterId !== undefined
        ? `nifi/registry-flows/?cluster_id=${clusterId}`
        : 'nifi/registry-flows/'
      return apiCall(url)
    },
    staleTime: 30 * 1000,
  })
}
