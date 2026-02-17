import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { NifiInstance, NifiInstanceFormValues, TestConnectionResult } from '../types'

function buildPayload(values: NifiInstanceFormValues) {
  let certificateName: string | null = null
  let oidcProviderId: string | null = null
  let username = ''
  let password = ''

  if (values.authMethod === 'oidc') {
    oidcProviderId = values.oidcProvider || null
  } else if (values.authMethod === 'username') {
    username = values.username
    password = values.password
  } else if (values.authMethod.startsWith('cert:')) {
    certificateName = values.authMethod.substring(5)
  }

  return {
    name: values.name || null,
    hierarchy_attribute: values.hierarchy_attribute,
    hierarchy_value: values.hierarchy_value,
    nifi_url: values.nifi_url,
    username,
    password,
    use_ssl: values.use_ssl,
    verify_ssl: values.verify_ssl,
    certificate_name: certificateName,
    oidc_provider_id: oidcProviderId,
    check_hostname: values.check_hostname,
  }
}

export function useNifiInstancesMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createInstance = useMutation({
    mutationFn: (values: NifiInstanceFormValues) =>
      apiCall('nifi/instances/', {
        method: 'POST',
        body: JSON.stringify(buildPayload(values)),
      }) as Promise<NifiInstance>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.instances() })
      toast({ title: 'Success', description: 'NiFi instance created successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const updateInstance = useMutation({
    mutationFn: ({ id, values }: { id: number; values: NifiInstanceFormValues }) =>
      apiCall(`nifi/instances/${id}`, {
        method: 'PUT',
        body: JSON.stringify(buildPayload(values)),
      }) as Promise<NifiInstance>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.instances() })
      toast({ title: 'Success', description: 'NiFi instance updated successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const deleteInstance = useMutation({
    mutationFn: (id: number) =>
      apiCall(`nifi/instances/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.instances() })
      toast({ title: 'Success', description: 'NiFi instance deleted.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const testSavedConnection = useMutation({
    mutationFn: (id: number) =>
      apiCall(`nifi/instances/${id}/test-connection`, {
        method: 'POST',
      }) as Promise<TestConnectionResult>,
  })

  const testNewConnection = useMutation({
    mutationFn: (values: NifiInstanceFormValues) =>
      apiCall('nifi/instances/test', {
        method: 'POST',
        body: JSON.stringify(buildPayload(values)),
      }) as Promise<TestConnectionResult>,
  })

  return {
    createInstance,
    updateInstance,
    deleteInstance,
    testSavedConnection,
    testNewConnection,
  }
}
