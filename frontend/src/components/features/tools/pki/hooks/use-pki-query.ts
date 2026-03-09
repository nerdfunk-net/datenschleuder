import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CAResponse, CertificateListResponse, CertificateResponse } from '../types'

export function useCAQuery() {
  const { apiCall } = useApi()
  return useQuery<CAResponse | null>({
    queryKey: queryKeys.pki.ca(),
    queryFn: async () => {
      try {
        return await apiCall<CAResponse>('pki/ca')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('404')) return null
        throw err
      }
    },
    staleTime: 60 * 1000,
    retry: false,
  })
}

export function useCertificatesQuery() {
  const { apiCall } = useApi()
  return useQuery<CertificateListResponse>({
    queryKey: queryKeys.pki.certificates(),
    queryFn: () => apiCall<CertificateListResponse>('pki/certificates'),
    staleTime: 30 * 1000,
  })
}

export function useCertificateQuery(id: number | null) {
  const { apiCall } = useApi()
  return useQuery<CertificateResponse>({
    queryKey: queryKeys.pki.certificate(id!),
    queryFn: () => apiCall<CertificateResponse>(`pki/certificates/${id}`),
    enabled: id !== null,
    staleTime: 60 * 1000,
  })
}
