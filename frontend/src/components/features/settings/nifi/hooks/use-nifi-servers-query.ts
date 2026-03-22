import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiServer } from '../types'

interface UseNifiServersQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNifiServersQueryOptions = {}

export function useNifiServersQuery(options: UseNifiServersQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<NifiServer[]>({
    queryKey: queryKeys.nifi.servers(),
    queryFn: () => apiCall('nifi/servers/') as Promise<NifiServer[]>,
    enabled,
    staleTime: 30 * 1000,
  })
}
