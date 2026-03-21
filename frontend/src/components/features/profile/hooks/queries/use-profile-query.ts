import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useAuthStore } from '@/lib/auth-store'

export interface ProfileServerCredential {
  id: string
  name: string
  username: string
  type: string
  password?: string
  has_ssh_key?: boolean
}

export interface ProfileServerData {
  username: string
  realname: string
  email: string
  api_key: string
  personal_credentials: ProfileServerCredential[]
}

interface UseProfileQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseProfileQueryOptions = {}

export function useProfileQuery(options: UseProfileQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { user } = useAuthStore()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.profile.data(),
    queryFn: () => apiCall<ProfileServerData>('profile'),
    enabled: enabled && !!user,
    staleTime: 60 * 1000,
  })
}
