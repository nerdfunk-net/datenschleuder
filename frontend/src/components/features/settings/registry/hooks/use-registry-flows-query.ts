import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { RegistryFlow } from '../types'

export function useRegistryFlowsQuery(nifiInstanceId?: number) {
  const { apiCall } = useApi()

  return useQuery<RegistryFlow[]>({
    queryKey: queryKeys.registryFlows.list(nifiInstanceId),
    queryFn: () => {
      const url = nifiInstanceId !== undefined
        ? `nifi/registry-flows/?nifi_instance=${nifiInstanceId}`
        : 'nifi/registry-flows/'
      return apiCall(url)
    },
    staleTime: 30 * 1000,
  })
}
