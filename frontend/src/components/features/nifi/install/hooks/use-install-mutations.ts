import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'

interface DeployFlowParams {
  instanceId: number
  missingPath: string
  flowId: number
  parameterContextId: string | null
  hierarchyAttribute: string | null
}

export function useDeployFlowMutation() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({
      instanceId,
      missingPath,
      flowId,
      parameterContextId,
      hierarchyAttribute,
    }: DeployFlowParams) => {
      const pathArray = missingPath.split('/').filter((p) => p.length > 0)
      const processGroupName = pathArray[pathArray.length - 1]
      const parentPath = pathArray.slice(0, -1).join('/')

      const body: Record<string, unknown> = {
        template_id: flowId,
        parent_process_group_path: parentPath || '/',
        process_group_name: processGroupName,
        stop_versioning_after_deploy: true,
      }

      if (hierarchyAttribute) {
        body.hierarchy_attribute = hierarchyAttribute
      }

      if (parameterContextId) {
        body.parameter_context_id = parameterContextId
      }

      return apiCall(`nifi/instances/${instanceId}/deploy`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (_data, { instanceId, missingPath }) => {
      toast({
        title: 'Flow deployed',
        description: `Successfully deployed flow to ${missingPath}`,
      })
      // Invalidate both source and destination check-path results for this instance
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifiInstall.checkPath(instanceId, 'source'),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifiInstall.checkPath(instanceId, 'destination'),
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Deployment failed',
        description: error.message || 'Failed to deploy flow',
        variant: 'destructive',
      })
    },
  })
}
