import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiInstance, HierarchyAttribute, Certificate, OidcProvider } from '../types'

interface UseQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseQueryOptions = {}

export function useNifiInstancesQuery(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<NifiInstance[]>({
    queryKey: queryKeys.nifi.instances(),
    queryFn: () => apiCall('nifi/instances/') as Promise<NifiInstance[]>,
    enabled,
    staleTime: 30 * 1000,
  })
}

export function useNifiHierarchyQuery(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<{ hierarchy: HierarchyAttribute[] }>({
    queryKey: queryKeys.nifi.hierarchy(),
    queryFn: () => apiCall('nifi/hierarchy/'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useNifiHierarchyValuesQuery(attributeName: string, options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<{ attribute_name: string; values: string[] }>({
    queryKey: queryKeys.nifi.hierarchyValues(attributeName),
    queryFn: () => apiCall(`nifi/hierarchy/values/${encodeURIComponent(attributeName)}`),
    enabled: enabled && !!attributeName,
    staleTime: 5 * 60 * 1000,
  })
}

export function useNifiCertificatesQuery(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<{ certificates: Certificate[] }>({
    queryKey: queryKeys.nifi.certificates(),
    queryFn: () => apiCall('nifi/certificates/'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useOidcProvidersQuery(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<{ providers: OidcProvider[] }>({
    queryKey: queryKeys.nifi.oidcProviders(),
    queryFn: async () => {
      try {
        return await apiCall('nifi/instances/oidc-providers')
      } catch {
        return { providers: [] }
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
