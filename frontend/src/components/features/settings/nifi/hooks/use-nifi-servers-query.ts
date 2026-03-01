import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiServer } from '../types'

export function useNifiServersQuery() {
  const { apiCall } = useApi()

  return useQuery<NifiServer[]>({
    queryKey: queryKeys.nifi.servers(),
    queryFn: () => apiCall('nifi/servers/') as Promise<NifiServer[]>,
    staleTime: 30 * 1000,
  })
}
