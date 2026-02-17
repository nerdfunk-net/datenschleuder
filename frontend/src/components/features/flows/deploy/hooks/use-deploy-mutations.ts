import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type { DeploymentRequest, DeploymentResponse, DeploymentSettings } from '../types'

/**
 * Deploy mutations for NiFi flows
 */
export function useDeployMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Deploy a single flow to a NiFi instance
   * Returns 409 on conflict (process group exists)
   */
  const deployFlow = useMutation({
    mutationFn: async ({
      instanceId,
      request,
    }: {
      instanceId: number
      request: DeploymentRequest
    }) => {
      return apiCall<DeploymentResponse>(`nifi/instances/${instanceId}/deploy`, {
        method: 'POST',
        body: JSON.stringify(request),
      })
    },
    // No onSuccess/onError here - caller handles results
  })

  /**
   * Delete a process group (used in conflict resolution)
   */
  const deleteProcessGroup = useMutation({
    mutationFn: async ({
      instanceId,
      processGroupId,
    }: {
      instanceId: number
      processGroupId: string
    }) => {
      return apiCall(`nifi/${instanceId}/process-groups/${processGroupId}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      toast({
        title: 'Process Group Deleted',
        description: 'Successfully deleted existing process group',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  /**
   * Update process group version (used in conflict resolution)
   */
  const updateProcessGroupVersion = useMutation({
    mutationFn: async ({
      instanceId,
      processGroupId,
      version,
    }: {
      instanceId: number
      processGroupId: string
      version: number
    }) => {
      return apiCall(`nifi/${instanceId}/process-groups/${processGroupId}/version`, {
        method: 'PUT',
        body: JSON.stringify({ version }),
      })
    },
    onSuccess: () => {
      toast({
        title: 'Version Updated',
        description: 'Successfully updated process group version',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  /**
   * Save deployment settings
   */
  const saveSettings = useMutation({
    mutationFn: async (settings: DeploymentSettings) => {
      return apiCall('nifi/hierarchy/deploy', {
        method: 'POST',
        body: JSON.stringify({ settings }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deploy.settings() })
      toast({
        title: 'Settings Saved',
        description: 'Deployment settings updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return {
    deployFlow,
    deleteProcessGroup,
    updateProcessGroupVersion,
    saveSettings,
  }
}
