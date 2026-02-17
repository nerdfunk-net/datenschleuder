import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'

export interface ViewPayload {
  name: string
  description?: string | null
  visible_columns: string[]
  column_widths?: Record<string, number> | null
  is_default?: boolean
}

export function useFlowViewsMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.flowViews.list() })

  const createView = useMutation({
    mutationFn: (data: ViewPayload) =>
      apiCall('nifi/flow-views/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'View saved.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateView = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ViewPayload> }) =>
      apiCall(`nifi/flow-views/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'View updated.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteView = useMutation({
    mutationFn: (id: number) => apiCall(`nifi/flow-views/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'View deleted.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const setDefaultView = useMutation({
    mutationFn: (id: number) =>
      apiCall(`nifi/flow-views/${id}/set-default`, { method: 'POST' }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Success', description: 'Default view updated.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return { createView, updateView, deleteView, setDefaultView }
}
