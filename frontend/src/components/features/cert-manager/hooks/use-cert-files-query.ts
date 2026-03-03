import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CertFileListResponse } from '../types'

export function useCertFilesQuery(instanceId: number | null) {
  const { apiCall } = useApi()

  return useQuery<CertFileListResponse>({
    queryKey: queryKeys.certManager.files(instanceId ?? 0),
    queryFn: () =>
      apiCall(`cert-manager/instances/${instanceId}/files`) as Promise<CertFileListResponse>,
    enabled: instanceId !== null,
    staleTime: 30 * 1000,
  })
}
