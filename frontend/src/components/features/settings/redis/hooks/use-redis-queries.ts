import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { RedisServer } from '../types'

interface UseRedisServersQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseRedisServersQueryOptions = {}

export function useRedisServersQuery(options: UseRedisServersQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<RedisServer[]>({
    queryKey: queryKeys.redis.servers(),
    queryFn: async () => {
      const response = await apiCall<{ success: boolean; data: RedisServer[] }>(
        'settings/redis',
        { method: 'GET' }
      )
      if (!response?.success) {
        throw new Error('Failed to load Redis servers')
      }
      return response.data ?? []
    },
    enabled,
    staleTime: 30 * 1000,
  })
}
