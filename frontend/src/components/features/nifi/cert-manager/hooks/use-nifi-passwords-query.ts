import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { NifiPasswordsResponse } from '../types'

export function useNifiPasswordsQuery(instanceId: number | null, filePath: string | null) {
  const { apiCall } = useApi()
  const isP12 = filePath?.toLowerCase().endsWith('.p12') ?? false

  return useQuery<NifiPasswordsResponse>({
    queryKey: queryKeys.certManager.nifiPasswords(instanceId ?? 0, filePath ?? ''),
    queryFn: () =>
      apiCall(
        `cert-manager/instances/${instanceId}/nifi-passwords?file_path=${encodeURIComponent(filePath!)}`,
      ) as Promise<NifiPasswordsResponse>,
    enabled: instanceId !== null && filePath !== null && isP12,
    staleTime: 60 * 1000,
  })
}
