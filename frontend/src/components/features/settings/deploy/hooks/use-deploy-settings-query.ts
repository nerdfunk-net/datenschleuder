import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DeploymentSettings } from '../types'

export function useDeploySettingsQuery() {
  const { apiCall } = useApi()

  return useQuery<DeploymentSettings>({
    queryKey: queryKeys.deploy.settings(),
    queryFn: () => apiCall('nifi/hierarchy/deploy'),
    staleTime: 5 * 60 * 1000,
  })
}
