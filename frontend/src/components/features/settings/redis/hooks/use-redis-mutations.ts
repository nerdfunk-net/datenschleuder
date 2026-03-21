import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { RedisServerCreatePayload, RedisServerUpdatePayload } from '../types'

export function useRedisServerMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createServer = useMutation({
    mutationFn: async (data: RedisServerCreatePayload) => {
      const response = await apiCall<{ success: boolean; data: unknown }>(
        'settings/redis',
        { method: 'POST', body: JSON.stringify(data) }
      )
      if (!response?.success) {
        throw new Error('Failed to create Redis server')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redis.servers() })
      toast({ title: 'Success', description: 'Redis server added' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateServer = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RedisServerUpdatePayload }) => {
      const response = await apiCall<{ success: boolean; data: unknown }>(
        `settings/redis/${id}`,
        { method: 'PUT', body: JSON.stringify(data) }
      )
      if (!response?.success) {
        throw new Error('Failed to update Redis server')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redis.servers() })
      toast({ title: 'Success', description: 'Redis server updated' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteServer = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiCall<{ success: boolean }>(
        `settings/redis/${id}`,
        { method: 'DELETE' }
      )
      if (!response?.success) {
        throw new Error('Failed to delete Redis server')
      }
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redis.servers() })
      toast({ title: 'Success', description: 'Redis server removed' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const testConnection = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiCall<{ success: boolean; status: string; details: unknown }>(
        `settings/redis/${id}/test-connection`,
        { method: 'POST' }
      )
      if (!response?.success) throw new Error('Connection failed')
      return response
    },
    onSuccess: () => {
      toast({ title: 'Connected', description: 'Redis server is reachable.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Connection failed', description: error.message, variant: 'destructive' })
    },
  })

  return useMemo(
    () => ({ createServer, updateServer, deleteServer, testConnection }),
    [createServer, updateServer, deleteServer, testConnection]
  )
}
