import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'

export function useRegistryFlowsMutations() {
  const { apiCall } = useApi()
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createFlows = useMutation({
    mutationFn: (flows: object[]) =>
      apiCall('nifi/registry-flows/', {
        method: 'POST',
        body: JSON.stringify(flows),
      }) as Promise<{ created: number; skipped: number; message: string }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.registryFlows.all })
      toast({
        title: 'Success',
        description: `Saved ${data.created} flow(s)${data.skipped > 0 ? `, ${data.skipped} duplicate(s) skipped` : ''}.`,
      })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteFlow = useMutation({
    mutationFn: (id: number) =>
      apiCall(`nifi/registry-flows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.registryFlows.all })
      toast({ title: 'Success', description: 'Flow removed.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  // Export uses direct fetch to handle blob response
  const exportFlow = async (
    instanceId: number,
    registryId: string,
    bucketId: string,
    flowId: string,
    flowName: string,
    format: 'json' | 'yaml' = 'json'
  ) => {
    const url = `/api/proxy/nifi/instances/${instanceId}/ops/registries/${registryId}/buckets/${bucketId}/export-flow?flow_id=${flowId}&mode=${format}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Export failed: ${text}`)
    }
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${flowName}.${format}`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return { createFlows, deleteFlow, exportFlow }
}
