import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DebugResponse } from '../types/oidc-types'

const DEFAULT_OPTIONS = {}

interface UseOidcDebugInfoOptions {
  enabled?: boolean
}

export function useOidcDebugInfo(options: UseOidcDebugInfoOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.oidc.debugInfo(),
    queryFn: () => apiCall<DebugResponse>('auth/oidc/debug'),
    enabled,
    staleTime: 30 * 1000,
  })
}
