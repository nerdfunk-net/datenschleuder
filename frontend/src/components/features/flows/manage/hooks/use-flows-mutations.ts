import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { NifiFlow } from '../types'

export interface FlowPayload {
  hierarchy_values: Record<string, { source: string; destination: string }>
  name?: string | null
  contact?: string | null
  src_connection_param: string
  dest_connection_param: string
  src_template_id?: number | null
  dest_template_id?: number | null
  active: boolean
  description?: string | null
}

export function useFlowsMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.flows.list() })

  const createFlow = useMutation({
    mutationFn: (data: FlowPayload) =>
      apiCall('nifi/flows/', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<NifiFlow>,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'Flow created successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateFlow = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FlowPayload> }) =>
      apiCall(`nifi/flows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<NifiFlow>,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'Flow updated successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteFlow = useMutation({
    mutationFn: (id: number) => apiCall(`nifi/flows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'Flow deleted.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const copyFlow = useMutation({
    mutationFn: (id: number) =>
      apiCall(`nifi/flows/${id}/copy`, { method: 'POST' }) as Promise<NifiFlow>,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'Flow copied successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return { createFlow, updateFlow, deleteFlow, copyFlow }
}
