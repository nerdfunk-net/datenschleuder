import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiCluster } from '../types'

export function useNifiClustersQuery() {
  const { apiCall } = useApi()

  return useQuery<NifiCluster[]>({
    queryKey: queryKeys.nifi.clusters(),
    queryFn: () => apiCall('nifi/clusters/') as Promise<NifiCluster[]>,
    staleTime: 30 * 1000,
  })
}
