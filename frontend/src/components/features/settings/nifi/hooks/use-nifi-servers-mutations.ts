import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { NifiServer } from '../types'

interface ServerInput {
  server_id: string
  hostname: string
  credential_id: number | null
}

export function useNifiServersMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createServer = useMutation({
    mutationFn: (data: ServerInput) =>
      apiCall('nifi/servers/', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<NifiServer>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.servers() })
      toast({ title: 'Success', description: 'NiFi server created successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateServer = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServerInput> }) =>
      apiCall(`nifi/servers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<NifiServer>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.servers() })
      toast({ title: 'Success', description: 'NiFi server updated successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteServer = useMutation({
    mutationFn: (id: number) =>
      apiCall(`nifi/servers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.servers() })
      toast({ title: 'Success', description: 'NiFi server deleted.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return { createServer, updateServer, deleteServer }
}
