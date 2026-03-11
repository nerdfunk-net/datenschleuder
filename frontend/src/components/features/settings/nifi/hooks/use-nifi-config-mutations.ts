import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'

interface WriteConfigFileInput {
  repoId: number
  path: string
  content: string
  commitMessage: string
}

export function useNifiConfigMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const writeConfigFile = useMutation({
    mutationFn: async ({ repoId, path, content, commitMessage }: WriteConfigFileInput) => {
      return apiCall(`api/git/${repoId}/file-content`, {
        method: 'PUT',
        body: JSON.stringify({
          path,
          content,
          commit_message: commitMessage,
        }),
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifi.bootstrapConfig(variables.repoId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.nifi.nifiProperties(variables.repoId),
      })
      toast({
        title: 'Configuration saved',
        description: 'Changes have been committed and pushed to the repository.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save configuration',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return useMemo(() => ({ writeConfigFile }), [writeConfigFile])
}
