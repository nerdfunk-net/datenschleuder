import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FileCertificatesResponse } from '../types'

interface UseCertificatesQueryOptions {
  instanceId: number | null
  filePath: string | null
  password?: string
}

export function useCertificatesQuery({
  instanceId,
  filePath,
  password,
}: UseCertificatesQueryOptions) {
  const { apiCall } = useApi()

  const params = new URLSearchParams()
  if (filePath) params.set('file_path', filePath)
  if (password) params.set('password', password)

  return useQuery<FileCertificatesResponse>({
    queryKey: [
      ...queryKeys.certManager.certificates(instanceId ?? 0, filePath ?? ''),
      password ?? '',
    ],
    queryFn: () =>
      apiCall(
        `cert-manager/instances/${instanceId}/certificates?${params.toString()}`
      ) as Promise<FileCertificatesResponse>,
    enabled: instanceId !== null && filePath !== null,
    staleTime: 60 * 1000,
    retry: false,
  })
}
