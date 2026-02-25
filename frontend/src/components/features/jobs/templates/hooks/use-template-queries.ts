import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { JobTemplate, JobType, GitRepository, CommandTemplate, CustomField, NifiInstance, ProcessGroup } from '../types'
import { STALE_TIME, EMPTY_TEMPLATES, EMPTY_TYPES, EMPTY_REPOS, EMPTY_CMD_TEMPLATES, EMPTY_CUSTOM_FIELDS, EMPTY_NIFI_INSTANCES, EMPTY_PROCESS_GROUPS } from '../utils/constants'

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
 * Fetch custom fields for devices
 * Replaces: fetchCustomFields() (lines 295-321)
 */
export function useCustomFields(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.customFields('devices'),
    queryFn: async () => {
      const response = await apiCall<CustomField[]>('/api/nautobot/custom-fields/devices', { method: 'GET' })
      const allFields = Array.isArray(response) ? response : []

      // Filter for text and date type custom fields that can hold timestamp
      const fields = allFields.filter((cf: CustomField) => {
        const cfType = cf.type?.value?.toLowerCase() || ''
        return ["text", "date", "datetime", "url"].includes(cfType)
      })

      return fields || EMPTY_CUSTOM_FIELDS
    },
    enabled,
    staleTime: STALE_TIME.CUSTOM_FIELDS,
  })
}

/**
 * Fetch all NiFi instances (used for check_queues template type)
 */
export function useNifiInstances(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nifi.instances(),
    queryFn: async () => {
      const response = await apiCall<NifiInstance[]>('/api/nifi/instances/', { method: 'GET' })
      return Array.isArray(response) ? response : EMPTY_NIFI_INSTANCES
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - instances rarely change
  })
}

interface UseProcessGroupsOptions extends UseQueryOptions {
  instanceId: number | null
}

const DEFAULT_PROCESS_GROUPS_OPTIONS: UseProcessGroupsOptions = { enabled: true, instanceId: null }

/**
 * Fetch all process groups (with full paths) for a given NiFi instance.
 * Used for the check_progress_group template type.
 */
export function useNifiProcessGroups(options: UseProcessGroupsOptions = DEFAULT_PROCESS_GROUPS_OPTIONS) {
  const { apiCall } = useApi()
  const { instanceId, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nifi.processGroupsAllPaths(instanceId ?? 0),
    queryFn: async () => {
      const response = await apiCall<{ status: string; process_groups: ProcessGroup[]; count: number; root_id: string }>(
        `/api/nifi/instances/${instanceId}/ops/process-groups/all-paths`,
        { method: 'GET' }
      )
      return response?.process_groups ?? EMPTY_PROCESS_GROUPS
    },
    enabled: enabled && instanceId !== null,
    staleTime: 30 * 1000, // 30 seconds - process groups may change
  })
}
