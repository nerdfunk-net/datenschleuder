import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { HierarchyConfig } from '../types'

export function useHierarchyQuery() {
  const { apiCall } = useApi()

  return useQuery<HierarchyConfig>({
    queryKey: queryKeys.nifi.hierarchy(),
    queryFn: () => apiCall('nifi/hierarchy/'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useHierarchyFlowCountQuery() {
  const { apiCall } = useApi()

  return useQuery<{ count: number }>({
    queryKey: queryKeys.nifi.hierarchyFlowCount(),
    queryFn: () => apiCall('nifi/hierarchy/flow-count'),
    staleTime: 30 * 1000,
  })
}

export function useHierarchyValuesQuery(attributeName: string) {
  const { apiCall } = useApi()

  return useQuery<{ attribute_name: string; values: string[] }>({
    queryKey: queryKeys.nifi.hierarchyValues(attributeName),
    queryFn: () => apiCall(`nifi/hierarchy/values/${encodeURIComponent(attributeName)}`),
    enabled: !!attributeName,
    staleTime: 60 * 1000,
  })
}
