import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface CertificateInfo {
  filename: string
  path: string
  size: number
  exists_in_system: boolean
}

export interface ScanResponse {
  success: boolean
  certificates: CertificateInfo[]
  certs_directory: string
  message?: string
}

interface UseCertificatesQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseCertificatesQueryOptions = {}

export function useCertificatesQuery(options: UseCertificatesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.systemCertificates.scan(),
    queryFn: async () => {
      const data = await apiCall<ScanResponse>('certificates/scan')
      if (!data.success) throw new Error(data.message || 'Failed to scan certificates')
      return data
    },
    enabled,
    staleTime: 30 * 1000,
  })
}
