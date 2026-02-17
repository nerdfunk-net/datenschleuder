import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { HierarchyConfig } from '../types'

export function useHierarchyMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const saveConfig = useMutation({
    mutationFn: (config: HierarchyConfig) =>
      apiCall('nifi/hierarchy/', {
        method: 'POST',
        body: JSON.stringify(config),
      }) as Promise<{ message: string; deleted_flows_count: number }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.hierarchy() })
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.instances() })
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.hierarchyFlowCount() })
      queryClient.invalidateQueries({ queryKey: queryKeys.flows.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.flows.columns() })
      const n = data.deleted_flows_count
      const description = n > 0
        ? `Hierarchy saved. ${n} existing flow${n !== 1 ? 's were' : ' was'} removed.`
        : 'Hierarchy settings saved successfully.'
      toast({ title: 'Success', description })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const saveValues = useMutation({
    mutationFn: ({ attributeName, values }: { attributeName: string; values: string[] }) =>
      apiCall('nifi/hierarchy/values', {
        method: 'POST',
        body: JSON.stringify({ attribute_name: attributeName, values }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifi.hierarchyValues(variables.attributeName),
      })
      toast({ title: 'Success', description: 'Values saved successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return { saveConfig, saveValues }
}
