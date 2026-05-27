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
      const result = await apiCall(`nifi/instances/${instanceId}/ops/parameters`) as ParameterContextsResponse
      return result
    },
    enabled: instanceId !== null && instanceId > 0,
    staleTime: 60 * 1000,
  })

  return query
}
