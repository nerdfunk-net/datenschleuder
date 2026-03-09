import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  CAResponse,
  CertificateResponse,
  CreateCARequest,
  CreateCertificateRequest,
  RevocationReason,
} from '../types'

export function usePKIMutations() {
  const { apiCall } = useApi()
  const token = useAuthStore((state) => state.token)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createCA = useMutation({
    mutationFn: (data: CreateCARequest) =>
      apiCall<CAResponse>('pki/ca', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pki.ca() })
      queryClient.invalidateQueries({ queryKey: queryKeys.pki.certificates() })
      toast({ title: 'CA created', description: 'Certificate Authority created successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create CA', description: error.message, variant: 'destructive' })
    },
  })

  const deleteCA = useMutation({
    mutationFn: () => apiCall('pki/ca', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pki.ca() })
      queryClient.invalidateQueries({ queryKey: queryKeys.pki.certificates() })
      toast({ title: 'CA deleted', description: 'Certificate Authority and all certificates deleted.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete CA', description: error.message, variant: 'destructive' })
    },
  })

  const createCertificate = useMutation({
    mutationFn: (data: CreateCertificateRequest) =>
      apiCall<CertificateResponse>('pki/certificates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pki.certificates() })
      toast({ title: 'Certificate issued', description: 'Certificate created successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to issue certificate', description: error.message, variant: 'destructive' })
    },
  })

  const revokeCertificate = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: RevocationReason }) =>
      apiCall<CertificateResponse>(`pki/certificates/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pki.certificates() })
      queryClient.invalidateQueries({ queryKey: queryKeys.pki.certificate(id) })
      toast({ title: 'Certificate revoked', description: 'Certificate has been revoked.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to revoke', description: error.message, variant: 'destructive' })
    },
  })

  const _download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const _fetchFile = async (
    endpoint: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<{ blob: Blob; filename: string }> => {
    const res = await fetch(`/api/proxy/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || 'Export failed')
    }
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') ?? ''
    const match = cd.match(/filename="([^"]+)"/)
    const filename = match?.[1] ?? 'download'
    return { blob, filename }
  }

  const exportCert = useMutation({
    mutationFn: (id: number) => _fetchFile(`pki/certificates/${id}/export/cert`, 'GET'),
    onSuccess: ({ blob, filename }) => {
      _download(blob, filename)
      toast({ title: 'Exported', description: 'Certificate PEM downloaded.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' })
    },
  })

  const exportPEM = useMutation({
    mutationFn: (id: number) => _fetchFile(`pki/certificates/${id}/export/pem`, 'GET'),
    onSuccess: ({ blob, filename }) => {
      _download(blob, filename)
      toast({ title: 'Exported', description: 'PEM bundle downloaded.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' })
    },
  })

  const exportPKCS12 = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      _fetchFile(`pki/certificates/${id}/export/pkcs12`, 'POST', { password }),
    onSuccess: ({ blob, filename }) => {
      _download(blob, filename)
      toast({ title: 'Exported', description: 'PKCS#12 bundle downloaded.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' })
    },
  })

  const exportPrivateKey = useMutation({
    mutationFn: ({ id, passphrase }: { id: number; passphrase?: string }) =>
      _fetchFile(`pki/certificates/${id}/export/key`, 'POST', { passphrase: passphrase ?? null }),
    onSuccess: ({ blob, filename }) => {
      _download(blob, filename)
      toast({ title: 'Exported', description: 'Private key downloaded.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' })
    },
  })

  return useMemo(
    () => ({
      createCA,
      deleteCA,
      createCertificate,
      revokeCertificate,
      exportCert,
      exportPEM,
      exportPKCS12,
      exportPrivateKey,
    }),
    [createCA, deleteCA, createCertificate, revokeCertificate, exportCert, exportPEM, exportPKCS12, exportPrivateKey],
  )
}
