import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { DeploymentSettings } from '../types'

export function useDeploySettingsMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const saveSettings = useMutation({
    mutationFn: (settings: DeploymentSettings) =>
      apiCall('nifi/hierarchy/deploy', {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deploy.settings() })
      toast({ title: 'Success', description: 'Deployment settings saved successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return { saveSettings }
}
