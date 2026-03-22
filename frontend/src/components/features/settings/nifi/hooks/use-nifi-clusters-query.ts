import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiCluster } from '../types'

interface UseNifiClustersQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNifiClustersQueryOptions = {}

export function useNifiClustersQuery(options: UseNifiClustersQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<NifiCluster[]>({
    queryKey: queryKeys.nifi.clusters(),
    queryFn: () => apiCall('nifi/clusters/') as Promise<NifiCluster[]>,
    enabled,
    staleTime: 30 * 1000,
  })
}
