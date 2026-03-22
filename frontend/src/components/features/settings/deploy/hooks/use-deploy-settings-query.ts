import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DeploymentSettings } from '../types'

interface UseDeploySettingsQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseDeploySettingsQueryOptions = {}

export function useDeploySettingsQuery(options: UseDeploySettingsQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery<DeploymentSettings>({
    queryKey: queryKeys.deploy.settings(),
    queryFn: () => apiCall('nifi/hierarchy/deploy'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
