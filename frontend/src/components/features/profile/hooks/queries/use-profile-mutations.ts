import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { ProfileServerData } from './use-profile-query'

export interface ProfileUpdatePayload {
  realname: string
  email: string
  api_key: string
  personal_credentials: Array<{
    id: string
    name: string
    username: string
    type: string
    password: string
    ssh_private_key?: string
    ssh_passphrase?: string
  }>
  password?: string
}

export function useProfileMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const updateProfile = useMutation({
    mutationFn: (data: ProfileUpdatePayload) =>
      apiCall<ProfileServerData>('profile', { method: 'PUT', body: data }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.profile.data(), data)
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return useMemo(() => ({ updateProfile }), [updateProfile])
}
