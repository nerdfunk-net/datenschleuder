import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiFlow, RegistryFlow } from '../types'

export function useFlowsQuery() {
  const { apiCall } = useApi()

  return useQuery<NifiFlow[]>({
    queryKey: queryKeys.flows.list(),
    queryFn: () => apiCall('nifi/flows/'),
    staleTime: 30 * 1000,
  })
}

export function useRegistryFlowsQuery() {
  const { apiCall } = useApi()

  return useQuery<RegistryFlow[]>({
    queryKey: queryKeys.registryFlows.list(),
    queryFn: () => apiCall('nifi/registry-flows/'),
    staleTime: 5 * 60 * 1000,
  })
}
