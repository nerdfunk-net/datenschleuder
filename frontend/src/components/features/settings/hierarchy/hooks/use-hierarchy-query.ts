import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { HierarchyConfig } from '../types'

interface UseQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseQueryOptions = {}

export function useHierarchyQuery(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<HierarchyConfig>({
    queryKey: queryKeys.nifi.hierarchy(),
    queryFn: () => apiCall('nifi/hierarchy/'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useHierarchyFlowCountQuery(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<{ count: number }>({
    queryKey: queryKeys.nifi.hierarchyFlowCount(),
    queryFn: () => apiCall('nifi/hierarchy/flow-count'),
    enabled,
    staleTime: 30 * 1000,
  })
}

export function useHierarchyValuesQuery(attributeName: string, options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<{ attribute_name: string; values: string[] }>({
    queryKey: queryKeys.nifi.hierarchyValues(attributeName),
    queryFn: () => apiCall(`nifi/hierarchy/values/${encodeURIComponent(attributeName)}`),
    enabled: enabled && !!attributeName,
    staleTime: 60 * 1000,
  })
}
