import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface ParameterContext {
  id: string
  name: string
}

interface ParameterContextsResponse {
  status: string
  parameter_contexts: ParameterContext[]
  count: number
}

export function useParameterContextsQuery(instanceId: number | null): UseQueryResult<ParameterContextsResponse> {
  const { apiCall } = useApi()

  const query = useQuery<ParameterContextsResponse>({
    queryKey: queryKeys.nifi.parameterContexts(instanceId ?? 0),
    queryFn: async () => {
      console.log(`[useParameterContextsQuery] Fetching parameter contexts for instance ${instanceId}`)
      const result = await apiCall(`nifi/instances/${instanceId}/ops/parameters`) as ParameterContextsResponse
      console.log(`[useParameterContextsQuery] Received ${result?.parameter_contexts?.length || 0} contexts`, result)
      return result
    },
    enabled: instanceId !== null && instanceId > 0,
    staleTime: 60 * 1000,
  })

  console.log('[useParameterContextsQuery]', { 
    instanceId, 
    enabled: instanceId !== null && instanceId > 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    dataCount: query.data?.parameter_contexts?.length || 0 
  })

  return query
}
