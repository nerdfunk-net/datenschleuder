import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiInstance, HierarchyAttribute, Certificate, OidcProvider } from '../types'

export function useNifiInstancesQuery(): UseQueryResult<NifiInstance[]> {
  const { apiCall } = useApi()

  const query = useQuery<NifiInstance[]>({
    queryKey: queryKeys.nifi.instances(),
    queryFn: async () => {
      console.log('[useNifiInstancesQuery] Fetching NiFi instances...')
      try {
        const result = await apiCall('nifi/instances/') as NifiInstance[]
        console.log('[useNifiInstancesQuery] Received instances:', result)
        return result
      } catch (error) {
        console.error('[useNifiInstancesQuery] Error fetching instances:', error)
        throw error
      }
    },
    staleTime: 30 * 1000,
  })

  console.log('[useNifiInstancesQuery] Query state:', {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    dataCount: Array.isArray(query.data) ? query.data.length : 'not-array',
    data: query.data
  })

  return query
}

export function useNifiHierarchyQuery() {
  const { apiCall } = useApi()

  return useQuery<{ hierarchy: HierarchyAttribute[] }>({
    queryKey: queryKeys.nifi.hierarchy(),
    queryFn: () => apiCall('nifi/hierarchy/'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useNifiHierarchyValuesQuery(attributeName: string) {
  const { apiCall } = useApi()

  return useQuery<{ attribute_name: string; values: string[] }>({
    queryKey: queryKeys.nifi.hierarchyValues(attributeName),
    queryFn: () => apiCall(`nifi/hierarchy/values/${encodeURIComponent(attributeName)}`),
    enabled: !!attributeName,
    staleTime: 5 * 60 * 1000,
  })
}

export function useNifiCertificatesQuery() {
  const { apiCall } = useApi()

  return useQuery<{ certificates: Certificate[] }>({
    queryKey: queryKeys.nifi.certificates(),
    queryFn: () => apiCall('nifi/certificates/'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useOidcProvidersQuery() {
  const { apiCall } = useApi()

  return useQuery<{ providers: OidcProvider[] }>({
    queryKey: queryKeys.nifi.oidcProviders(),
    queryFn: async () => {
      try {
        return await apiCall('nifi/instances/oidc-providers')
      } catch {
        return { providers: [] }
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}
