import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FlowMetadataResponse } from '../types'

export function useRegistryFlowMetadataQuery(flowId: number | null) {
  const { apiCall } = useApi()

  return useQuery<FlowMetadataResponse[]>({
    queryKey: queryKeys.registryFlows.metadata(flowId!),
    queryFn: () => apiCall(`nifi/registry-flows/${flowId}/metadata`),
    enabled: flowId !== null,
    staleTime: 30 * 1000,
  })
}
