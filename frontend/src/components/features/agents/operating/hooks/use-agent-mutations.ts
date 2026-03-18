import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type { GitPullInput, DockerRestartInput, CommandResult } from '../types'

export function useAgentMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const gitPull = useMutation({
    mutationFn: async (input: GitPullInput): Promise<CommandResult> => {
      return apiCall<CommandResult>(`datenschleuder-agent/${input.agent_id}/git-pull`, {
        method: 'POST',
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.history(variables.agent_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list() })
      toast({
        title: 'Git Pull Completed',
        description: data.output || `Command executed in ${data.execution_time_ms}ms`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Git Pull Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const dockerRestart = useMutation({
    mutationFn: async (input: DockerRestartInput): Promise<CommandResult> => {
      return apiCall<CommandResult>(`datenschleuder-agent/${input.agent_id}/docker-restart`, {
        method: 'POST',
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.history(variables.agent_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list() })
      toast({
        title: 'Docker Restart Completed',
        description: data.output || `Container restarted in ${data.execution_time_ms}ms`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Docker Restart Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const sendCommand = useMutation({
    mutationFn: async (input: {
      agent_id: string
      command: string
      params?: Record<string, unknown>
    }): Promise<CommandResult> => {
      return apiCall<CommandResult>('datenschleuder-agent/command', {
        method: 'POST',
        body: JSON.stringify({ ...input, params: input.params ?? {} }),
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Command failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return { gitPull, dockerRestart, sendCommand }
}
