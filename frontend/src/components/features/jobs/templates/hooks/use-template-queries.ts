import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobTemplate, JobType, GitRepository, CommandTemplate, NifiCluster, ProcessGroup } from '../types'
import { STALE_TIME, EMPTY_TEMPLATES, EMPTY_TYPES, EMPTY_REPOS, EMPTY_CMD_TEMPLATES, EMPTY_NIFI_CLUSTERS, EMPTY_PROCESS_GROUPS } from '../utils/constants'

interface UseQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseQueryOptions = { enabled: true }

/**
 * Fetch all job templates
 * Replaces: fetchTemplates() (lines 181-201)
 */
export function useJobTemplates(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.templates(),
    queryFn: async () => {
      const response = await apiCall<{ templates: JobTemplate[] }>('/api/job-templates', { method: 'GET' })
      return response?.templates || EMPTY_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })
}

/**
 * Fetch available job types
 * Replaces: fetchJobTypes() (lines 204-222)
 */
export function useJobTypes(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.jobTypes(),
    queryFn: async () => {
      const response = await apiCall<JobType[]>('/api/job-templates/types', { method: 'GET' })
      return response || EMPTY_TYPES
    },
    enabled,
    staleTime: STALE_TIME.JOB_TYPES,
  })
}

/**
 * Fetch config repositories
 * Replaces: fetchConfigRepos() (lines 225-243)
 */
export function useConfigRepos(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.configRepos('device_configs'),
    queryFn: async () => {
      const response = await apiCall<{ repositories: GitRepository[] }>(
        '/api/git-repositories?category=device_configs',
        { method: 'GET' }
      )
      return response?.repositories || EMPTY_REPOS
    },
    enabled,
    staleTime: STALE_TIME.CONFIG_REPOS,
  })
}

// useSavedInventories removed - inventory feature no longer exists in scaffold

/**
 * Fetch command templates
 * Replaces: fetchCommandTemplates() (lines 274-292)
 */
export function useCommandTemplates(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.commandTemplates(),
    queryFn: async () => {
      const response = await apiCall<{ templates: CommandTemplate[] }>('/api/templates', { method: 'GET' })
      return response?.templates || EMPTY_CMD_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.CMD_TEMPLATES,
  })
}

/**
 * Fetch all NiFi clusters (used for check_queues and check_progress_group template types).
 */
export function useNifiClusters(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nifi.clusters(),
    queryFn: async () => {
      const response = await apiCall<NifiCluster[]>('/api/nifi/clusters/', { method: 'GET' })
      return Array.isArray(response) ? response : EMPTY_NIFI_CLUSTERS
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - clusters rarely change
  })
}

interface UseClusterProcessGroupsOptions extends UseQueryOptions {
  clusterId: number | null
}

const DEFAULT_CLUSTER_PROCESS_GROUPS_OPTIONS: UseClusterProcessGroupsOptions = { enabled: true, clusterId: null }

/**
 * Fetch all process groups (with full paths) via a NiFi cluster's primary instance.
 * Used for the check_progress_group template type.
 */
export function useNifiClusterProcessGroups(options: UseClusterProcessGroupsOptions = DEFAULT_CLUSTER_PROCESS_GROUPS_OPTIONS) {
  const { apiCall } = useApi()
  const { clusterId, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nifi.clusterProcessGroupsAllPaths(clusterId ?? 0),
    queryFn: async () => {
      const response = await apiCall<{ status: string; process_groups: ProcessGroup[]; count: number; root_id: string }>(
        `/api/nifi/clusters/${clusterId}/ops/process-groups/all-paths`,
        { method: 'GET' }
      )
      return response?.process_groups ?? EMPTY_PROCESS_GROUPS
    },
    enabled: enabled && clusterId !== null,
    staleTime: 30 * 1000, // 30 seconds - process groups may change
  })
}
