import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { ParameterContextListResponse, ParameterContextDetailResponse } from '../types'

export function useParameterContextsListQuery(instanceId: number | null) {
  const { apiCall } = useApi()

  return useQuery<ParameterContextListResponse>({
    queryKey: queryKeys.nifi.parameterContexts(instanceId ?? 0),
    queryFn: () =>
      apiCall<ParameterContextListResponse>(`nifi/instances/${instanceId}/ops/parameters`),
    enabled: instanceId !== null,
    staleTime: 30 * 1000,
  })
}

export function useParameterContextDetailQuery(
  instanceId: number | null,
  contextId: string | null,
) {
  const { apiCall } = useApi()

  return useQuery<ParameterContextDetailResponse>({
    queryKey: queryKeys.nifi.parameterContextDetail(instanceId ?? 0, contextId ?? ''),
    queryFn: () =>
      apiCall<ParameterContextDetailResponse>(
        `nifi/instances/${instanceId}/ops/parameter-contexts/${contextId}`,
      ),
    enabled: instanceId !== null && contextId !== null,
    staleTime: 0,
  })
}
