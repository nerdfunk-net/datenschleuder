import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'

interface MetadataItemInput {
  key: string
  value: string
  is_mandatory: boolean
}

interface SetMetadataVariables {
  flowId: number
  items: MetadataItemInput[]
}

export function useRegistryFlowMetadataMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const setMetadata = useMutation({
    mutationFn: ({ flowId, items }: SetMetadataVariables) =>
      apiCall(`nifi/registry-flows/${flowId}/metadata`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
      }),
    onSuccess: (_data, { flowId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.registryFlows.metadata(flowId),
      })
      toast({ title: 'Saved', description: 'Metadata updated.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return useMemo(() => ({ setMetadata }), [setMetadata])
}
