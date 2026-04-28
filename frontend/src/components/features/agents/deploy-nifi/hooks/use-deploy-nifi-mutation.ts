import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import type { DeployNifiPayload } from '../types'

interface UseDeployNifiMutationOptions {
  agentId: string
  onSuccess?: (output: string) => void
  onError?: (error: string) => void
}

export function useDeployNifiMutation({ agentId, onSuccess, onError }: UseDeployNifiMutationOptions) {
  const { apiCall } = useApi()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (payload: DeployNifiPayload) =>
      apiCall<{ output?: string }>(`datenschleuder-agent/${agentId}/deploy-nifi`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data: { output?: string }) => {
      toast({ title: 'Deployment successful', description: 'NiFi has been deployed.' })
      onSuccess?.(data?.output ?? '')
    },
    onError: (error: Error) => {
      toast({
        title: 'Deployment failed',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error.message)
    },
  })
}
