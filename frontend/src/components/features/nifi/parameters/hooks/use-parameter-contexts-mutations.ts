import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'

interface ParameterInput {
  name: string
  description?: string
  sensitive: boolean
  value?: string
}

export interface CreateContextInput {
  instanceId: number
  name: string
  description?: string
  parameters: ParameterInput[]
}

export interface UpdateContextInput {
  instanceId: number
  contextId: string
  name?: string
  description?: string
  parameters?: ParameterInput[]
  inherited_parameter_contexts?: string[]
}

export interface DeleteContextInput {
  instanceId: number
  contextId: string
}

export function useParameterContextMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createContext = useMutation({
    mutationFn: ({ instanceId, name, description, parameters }: CreateContextInput) =>
      apiCall(`nifi/instances/${instanceId}/ops/parameter-contexts`, {
        method: 'POST',
        body: JSON.stringify({ name, description, parameters }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifi.parameterContexts(variables.instanceId),
      })
      toast({ title: 'Success', description: 'Parameter context created' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateContext = useMutation({
    mutationFn: ({ instanceId, contextId, ...data }: UpdateContextInput) =>
      apiCall(`nifi/instances/${instanceId}/ops/parameter-contexts/${contextId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifi.parameterContexts(variables.instanceId),
      })
      toast({ title: 'Success', description: 'Parameter context updated' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteContext = useMutation({
    mutationFn: ({ instanceId, contextId }: DeleteContextInput) =>
      apiCall(`nifi/instances/${instanceId}/ops/parameter-contexts/${contextId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifi.parameterContexts(variables.instanceId),
      })
      toast({ title: 'Success', description: 'Parameter context deleted' })
    },
    // onError intentionally omitted — callers handle 409 (bound PGs) specially
  })

  return { createContext, updateContext, deleteContext }
}
