import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import type { FlowImportRequest, FlowImportResponse } from '../types'

export function useImportMutations() {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const runImport = useMutation({
    mutationFn: async (data: FlowImportRequest) => {
      return apiCall<FlowImportResponse>('nifi/flows/import', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { runImport }
}
