import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { SchemaStatus, AppliedMigration, MigrationResponse } from '../types/database-migration-types'

const EMPTY_MIGRATIONS: AppliedMigration[] = []

export function useDatabaseMigration() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null)

  const statusQuery = useQuery({
    queryKey: queryKeys.schema.status(),
    queryFn: () => apiCall<SchemaStatus>('tools/schema/status'),
    staleTime: 30 * 1000,
  })

  const status = statusQuery.data ?? null

  const migrationsQuery = useQuery({
    queryKey: queryKeys.schema.migrations(),
    queryFn: () => apiCall<{ migrations: AppliedMigration[] }>('tools/schema/migrations'),
    enabled: !!status?.migration_system?.active,
    staleTime: 30 * 1000,
  })

  const appliedMigrations = migrationsQuery.data?.migrations ?? EMPTY_MIGRATIONS

  const migrateMutation = useMutation({
    mutationFn: () => apiCall<MigrationResponse>('tools/schema/migrate', { method: 'POST' }),
    onSuccess: (data) => {
      setMigrationResult(data)
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.schema.status() })
        queryClient.invalidateQueries({ queryKey: queryKeys.schema.migrations() })
      }
    },
    onError: (err: Error) => {
      const message = err.message || 'Network or server error during migration'
      setMigrationResult({
        success: false,
        message,
        changes: [],
        errors: [message],
      })
    },
  })

  return {
    status,
    appliedMigrations,
    loading: statusQuery.isLoading,
    error: statusQuery.isError ? (statusQuery.error as Error).message : null,
    migrating: migrateMutation.isPending,
    migrationResult,
    refetch: statusQuery.refetch,
    handleMigrate: migrateMutation.mutate,
  }
}
