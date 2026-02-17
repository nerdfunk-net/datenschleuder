import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FlowView } from '../types'

export function useFlowViewsQuery() {
  const { apiCall } = useApi()

  return useQuery<FlowView[]>({
    queryKey: queryKeys.flowViews.list(),
    queryFn: () => apiCall('nifi/flow-views/'),
    staleTime: 30 * 1000,
  })
}
