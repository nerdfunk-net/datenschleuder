import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

/**
 * Fetch a config file from a git repository.
 * The proxy converts PlainTextResponse to a JSON-encoded string.
 */
export function useNifiConfigFileQuery(
  repoId: number | null,
  path: string,
  queryKey: readonly unknown[],
) {
  const { apiCall } = useApi()

  return useQuery<string>({
    queryKey,
    queryFn: async () => {
      const result = await apiCall<string>(
        `api/git/${repoId}/file-content?path=${encodeURIComponent(path)}`
      )
      return result
    },
    enabled: repoId != null,
    staleTime: 30 * 1000,
  })
}
