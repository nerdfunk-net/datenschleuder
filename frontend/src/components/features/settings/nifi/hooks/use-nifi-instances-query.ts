import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiInstance, HierarchyAttribute, Certificate, OidcProvider } from '../types'

export function useNifiInstancesQuery() {
  const { apiCall } = useApi()

  return useQuery<NifiInstance[]>({
    queryKey: queryKeys.nifi.instances(),
    queryFn: () => apiCall('nifi/instances/'),
    staleTime: 30 * 1000,
  })
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
