import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { GitRepository } from '../types'

interface ReposResponse {
  repositories: GitRepository[]
  total: number
}

export function useImportReposQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.flows.importRepos(),
    queryFn: () => apiCall<ReposResponse>('git-repositories?category=import', { method: 'GET' }),
    staleTime: 60 * 1000,
  })
}
