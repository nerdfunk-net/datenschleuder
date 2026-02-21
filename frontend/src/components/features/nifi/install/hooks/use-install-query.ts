import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { CheckPathResponse, ParameterContext } from '../types'
import type { RegistryFlow } from '@/components/features/flows/manage/types'

// Stable empty defaults (prevent re-render loops)
const EMPTY_REGISTRY_FLOWS: RegistryFlow[] = []
const EMPTY_CONTEXTS: ParameterContext[] = []

export function useCheckPathQuery(
  instanceId: number | null,
  pathType: 'source' | 'destination',
  enabled = true,
) {
  const { apiCall } = useApi()

  return useQuery<CheckPathResponse>({
    queryKey: queryKeys.nifiInstall.checkPath(instanceId ?? 0, pathType),
    queryFn: () =>
      apiCall(
        `nifi/install/check-path?instance_id=${instanceId}&path_type=${pathType}`,
      ),
    enabled: enabled && instanceId !== null,
    staleTime: 0, // Always re-fetch — paths change when flows are deployed
  })
}

export function useParameterContextsQuery(instanceId: number | null) {
  const { apiCall } = useApi()

  return useQuery<ParameterContext[]>({
    queryKey: queryKeys.nifi.parameterContexts(instanceId ?? 0),
    queryFn: async () => {
      const result = await apiCall<{ parameter_contexts: ParameterContext[] }>(
        `nifi/instances/${instanceId}/ops/parameters`,
      )
      return result?.parameter_contexts ?? EMPTY_CONTEXTS
    },
    enabled: instanceId !== null,
    staleTime: 2 * 60 * 1000,
  })
}

export function useRegistryFlowsByInstanceQuery(instanceId: number | null) {
  const { apiCall } = useApi()

  return useQuery<RegistryFlow[]>({
    queryKey: queryKeys.registryFlows.list(instanceId ?? undefined),
    queryFn: async () => {
      const url = instanceId
        ? `nifi/registry-flows/?nifi_instance=${instanceId}`
        : 'nifi/registry-flows/'
      const result = await apiCall<RegistryFlow[]>(url)
      return result ?? EMPTY_REGISTRY_FLOWS
    },
    enabled: instanceId !== null,
    staleTime: 5 * 60 * 1000,
  })
}
