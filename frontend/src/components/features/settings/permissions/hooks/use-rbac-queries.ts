import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Role, Permission, UsersResponse, RoleWithPermissions } from '../types'
import { CACHE_TIME, EMPTY_USERS, EMPTY_ROLES, EMPTY_PERMISSIONS } from '../utils/constants'

interface UseQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseQueryOptions = {}

/**
 * Fetch all users with automatic caching
 */
export function useRbacUsers(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.users(),
    queryFn: async () => {
      const response = await apiCall<UsersResponse>('rbac/users', { method: 'GET' })
      return response.users || EMPTY_USERS
    },
    enabled,
    staleTime: CACHE_TIME.USERS,
  })
}

/**
 * Fetch all roles with automatic caching
 */
export function useRbacRoles(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.roles(),
    queryFn: async () => {
      const response = await apiCall<Role[]>('rbac/roles', { method: 'GET' })
      return response || EMPTY_ROLES
    },
    enabled,
    staleTime: CACHE_TIME.ROLES,
  })
}

/**
 * Fetch all permissions with automatic caching
 */
export function useRbacPermissions(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.permissions(),
    queryFn: async () => {
      const response = await apiCall<Permission[]>('rbac/permissions', { method: 'GET' })
      return response || EMPTY_PERMISSIONS
    },
    enabled,
    staleTime: CACHE_TIME.PERMISSIONS,
  })
}

/**
 * Fetch role with its permissions
 */
export function useRolePermissions(roleId: number | null, options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.rolePermissions(roleId!),
    queryFn: async () => {
      const response = await apiCall<RoleWithPermissions>(`rbac/roles/${roleId}`, { method: 'GET' })
      return response
    },
    enabled: enabled && !!roleId,
    staleTime: CACHE_TIME.ROLES,
  })
}

/**
 * Fetch user's effective permissions (from roles + overrides)
 */
export function useUserPermissions(userId: number | null, options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.userPermissions(userId!),
    queryFn: async () => {
      const response = await apiCall<Permission[]>(`rbac/users/${userId}/permissions`, { method: 'GET' })
      return response || EMPTY_PERMISSIONS
    },
    enabled: enabled && !!userId,
    staleTime: CACHE_TIME.USERS,
  })
}

/**
 * Fetch user's explicit permission overrides
 */
export function useUserPermissionOverrides(userId: number | null, options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.rbac.userPermissions(userId!),
    queryFn: async () => {
      const response = await apiCall<Permission[]>(`rbac/users/${userId}/permissions/overrides`, { method: 'GET' })
      return response || EMPTY_PERMISSIONS
    },
    enabled: enabled && !!userId,
    staleTime: 0, // Always fetch fresh for overrides
  })
}
