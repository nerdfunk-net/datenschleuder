import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { NifiCluster } from '../types'

interface ClusterMemberInput {
  instance_id: number
  is_primary: boolean
}

interface ClusterInput {
  cluster_id: string
  hierarchy_attribute: string
  hierarchy_value: string
  members: ClusterMemberInput[]
}

interface ClusterUpdateInput {
  cluster_id?: string
  hierarchy_attribute?: string
  hierarchy_value?: string
  members?: ClusterMemberInput[]
}

export function useNifiClustersMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createCluster = useMutation({
    mutationFn: (data: ClusterInput) =>
      apiCall('nifi/clusters/', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<NifiCluster>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.clusters() })
      toast({ title: 'Success', description: 'NiFi cluster created successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateCluster = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ClusterUpdateInput }) =>
      apiCall(`nifi/clusters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<NifiCluster>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.clusters() })
      toast({ title: 'Success', description: 'NiFi cluster updated successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteCluster = useMutation({
    mutationFn: (id: number) =>
      apiCall(`nifi/clusters/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.clusters() })
      toast({ title: 'Success', description: 'NiFi cluster deleted.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return useMemo(
    () => ({ createCluster, updateCluster, deleteCluster }),
    [createCluster, updateCluster, deleteCluster],
  )
}
