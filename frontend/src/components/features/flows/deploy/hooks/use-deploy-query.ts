import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  DeploymentSettings,
  ProcessGroupPath,
  FlowVersion,
  RegistryFlow,
} from '../types'

// Default empty arrays (following React best practices)
const EMPTY_PATHS: ProcessGroupPath[] = []
const EMPTY_VERSIONS: FlowVersion[] = []

interface ProcessGroupsResponse {
  status: string
  process_groups: ProcessGroupPath[]
}

interface VersionsResponse {
  status: string
  versions: FlowVersion[]
}

interface DeploymentSettingsResponse {
  settings: DeploymentSettings
}

/**
 * Fetch deployment settings (global + per-instance paths)
 */
export function useDeploymentSettingsQuery(): UseQueryResult<DeploymentSettings> {
  const { apiCall } = useApi()

  return useQuery<DeploymentSettings>({
    queryKey: queryKeys.deploy.settings(),
    queryFn: async () => {
      const result = await apiCall<DeploymentSettingsResponse>('nifi/hierarchy/deploy')
      return result?.settings || getDefaultSettings()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Fetch process group paths for a specific NiFi instance + hierarchy value
 * Used in Step 3 to populate process group dropdown
 */
export function useProcessGroupPathsQuery(
  instanceId: number | null,
  hierarchyValue: string
): UseQueryResult<ProcessGroupPath[]> {
  const { apiCall } = useApi()

  return useQuery<ProcessGroupPath[]>({
    queryKey: queryKeys.deploy.processGroups(instanceId ?? 0, hierarchyValue),
    queryFn: async () => {
      if (!instanceId) return EMPTY_PATHS

      const result = await apiCall<ProcessGroupsResponse>(
        `nifi-instances/${instanceId}/get-all-paths`
      )

      return result?.process_groups || EMPTY_PATHS
    },
    enabled: !!instanceId && !!hierarchyValue,
    staleTime: 2 * 60 * 1000, // 2 minutes (paths change infrequently)
  })
}

/**
 * Fetch available versions for a specific flow in a registry
 * Used in Step 4 to populate version dropdown
 */
export function useFlowVersionsQuery(
  instanceId: number | null,
  registryId: string | null,
  bucketId: string | null,
  flowId: string | null
): UseQueryResult<FlowVersion[]> {
  const { apiCall } = useApi()

  return useQuery<FlowVersion[]>({
    queryKey: queryKeys.deploy.versions(
      instanceId ?? 0,
      registryId ?? '',
      bucketId ?? '',
      flowId ?? ''
    ),
    queryFn: async () => {
      if (!instanceId || !registryId || !bucketId || !flowId) {
        return EMPTY_VERSIONS
      }

      const result = await apiCall<VersionsResponse>(
        `nifi/${instanceId}/registry/${registryId}/${bucketId}/${flowId}/get-versions`
      )

      return result?.versions || EMPTY_VERSIONS
    },
    enabled: !!instanceId && !!registryId && !!bucketId && !!flowId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Fetch registry flows (DB-backed mapping of NiFi flows to registry details)
 * Used to lookup registry info for deployment configs
 */
export function useRegistryFlowsQuery(): UseQueryResult<RegistryFlow[]> {
  const { apiCall } = useApi()

  return useQuery<RegistryFlow[]>({
    queryKey: queryKeys.registryFlows.list(),
    queryFn: async () => {
      const result = await apiCall<RegistryFlow[]>('nifi/registry-flows')
      return result || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Default deployment settings
 */
function getDefaultSettings(): DeploymentSettings {
  return {
    global: {
      process_group_name_template: '{last_hierarchy_value}',
      disable_after_deploy: false,
      stop_versioning_after_deploy: false,
      start_after_deploy: false,
    },
    paths: {},
  }
}
