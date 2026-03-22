import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FlowMetadataResponse } from '../types'

interface UseRegistryFlowMetadataQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseRegistryFlowMetadataQueryOptions = {}

export function useRegistryFlowMetadataQuery(
  flowId: number | null,
  options: UseRegistryFlowMetadataQueryOptions = DEFAULT_OPTIONS,
) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<FlowMetadataResponse[]>({
    queryKey: queryKeys.registryFlows.metadata(flowId!),
    queryFn: () => apiCall(`nifi/registry-flows/${flowId}/metadata`),
    enabled: enabled && flowId !== null,
    staleTime: 30 * 1000,
  })
}
