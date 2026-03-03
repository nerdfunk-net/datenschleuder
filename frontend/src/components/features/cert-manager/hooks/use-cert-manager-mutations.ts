import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type {
  ConvertRequest,
  ConvertResponse,
  ExportRequest,
  CreateKeystoreRequest,
  CreateTruststoreRequest,
  KeystoreCreateResponse,
} from '../types'

export function useCertManagerMutations() {
  const { apiCall } = useApi()
  const token = useAuthStore((state) => state.token)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const convertCert = useMutation({
    mutationFn: (request: ConvertRequest) =>
      apiCall('cert-manager/convert', {
        method: 'POST',
        body: JSON.stringify(request),
      }) as Promise<ConvertResponse>,
    onSuccess: (_, req) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.certManager.files(req.instance_id),
      })
      toast({ title: 'Converted', description: 'Certificate converted and committed to git.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Conversion failed', description: error.message, variant: 'destructive' })
    },
  })

  const exportCert = useMutation({
    mutationFn: async (request: ExportRequest) => {
      const res = await fetch('/api/proxy/cert-manager/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'Export failed')
      }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
      const filename = filenameMatch?.[1] ?? `export.${request.format}`
      return { blob, filename }
    },
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Exported', description: 'Certificate exported successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' })
    },
  })

  const importCert = useMutation({
    mutationFn: async ({
      instanceId,
      targetFilePath,
      password,
      file,
    }: {
      instanceId: number
      targetFilePath: string
      password?: string
      file: File
    }) => {
      const params = new URLSearchParams({
        instance_id: String(instanceId),
        target_file_path: targetFilePath,
      })
      if (password) params.set('password', password)

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/proxy/cert-manager/import?${params.toString()}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Import failed' }))
        throw new Error(err.detail || 'Import failed')
      }
      return res.json()
    },
    onSuccess: (_, { instanceId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.certManager.files(instanceId),
      })
      toast({ title: 'Imported', description: 'Certificate imported and committed to git.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' })
    },
  })

  const createKeystore = useMutation({
    mutationFn: (request: CreateKeystoreRequest) =>
      apiCall('cert-manager/create-keystore', {
        method: 'POST',
        body: JSON.stringify(request),
      }) as Promise<KeystoreCreateResponse>,
    onSuccess: (_, req) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.certManager.files(req.instance_id),
      })
      toast({ title: 'Keystore created', description: 'New keystore committed to git.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Creation failed', description: error.message, variant: 'destructive' })
    },
  })

  const createTruststore = useMutation({
    mutationFn: (request: CreateTruststoreRequest) =>
      apiCall('cert-manager/create-truststore', {
        method: 'POST',
        body: JSON.stringify(request),
      }) as Promise<KeystoreCreateResponse>,
    onSuccess: (_, req) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.certManager.files(req.instance_id),
      })
      toast({ title: 'Truststore created', description: 'New truststore committed to git.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Creation failed', description: error.message, variant: 'destructive' })
    },
  })

  return { convertCert, exportCert, importCert, createKeystore, createTruststore }
}
