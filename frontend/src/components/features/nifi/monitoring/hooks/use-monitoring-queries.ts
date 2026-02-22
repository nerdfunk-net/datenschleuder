'use client'

import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  NifiInstance,
  Flow,
  SystemDiagnosticsResponse,
  Connection,
} from '../types'

const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_FLOWS: Flow[] = []
const EMPTY_CONNECTIONS: Connection[] = []

export function useNifiInstancesQuery() {
  const { apiCall } = useApi()

  return useQuery<NifiInstance[]>({
    queryKey: queryKeys.nifi.instances(),
    queryFn: async () => {
      const result = await apiCall<NifiInstance[]>('nifi/instances/')
      return result ?? EMPTY_INSTANCES
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useMonitoringFlowsQuery() {
  const { apiCall } = useApi()

  return useQuery<Flow[]>({
    queryKey: queryKeys.nifi.monitoringFlows(),
    queryFn: async () => {
      const result = await apiCall<Flow[]>('nifi/flows/')
      return result ?? EMPTY_FLOWS
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function useSystemDiagnosticsQuery(instanceId: number | null) {
  const { apiCall } = useApi()

  return useQuery<SystemDiagnosticsResponse>({
    queryKey: queryKeys.nifi.systemDiagnostics(instanceId ?? 0),
    queryFn: () =>
      apiCall<SystemDiagnosticsResponse>(
        `nifi/instances/${instanceId}/ops/system-diagnostics`,
      ),
    enabled: instanceId !== null,
    staleTime: 30 * 1000,
  })
}

export function useQueuesQuery(instanceId: number | null, enabled: boolean) {
  const { apiCall } = useApi()

  return useQuery<Connection[]>({
    queryKey: queryKeys.nifi.queues(instanceId ?? 0),
    queryFn: async () => {
      const result = await apiCall<{
        status: string
        components: Connection[]
        count: number
      }>(`nifi/${instanceId}/list-all-by-kind?kind=connections`)
      return result?.components ?? EMPTY_CONNECTIONS
    },
    enabled: enabled && instanceId !== null,
    staleTime: 0,
  })
}
