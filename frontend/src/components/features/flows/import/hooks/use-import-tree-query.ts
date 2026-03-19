import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

interface TreeNode {
  name: string
  path: string
  type: 'directory'
  file_count: number
  children: TreeNode[]
  repository_name?: string
}

export type { TreeNode }

export function useImportTreeQuery(repoId: number | null, path: string = '') {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.flows.importTree(repoId ?? 0, path || undefined),
    queryFn: () => {
      const pathParam = path ? `&path=${encodeURIComponent(path)}` : ''
      return apiCall<TreeNode>(`git/${repoId}/tree?${pathParam}`, { method: 'GET' })
    },
    enabled: repoId !== null,
    staleTime: 30 * 1000,
  })
}
