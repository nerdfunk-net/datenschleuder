import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import type { SeedRbacResponse } from '../types/database-migration-types'

export function useRbacSeeding() {
  const { apiCall } = useApi()
  const [showSeedDialog, setShowSeedDialog] = useState(false)
  const [showSeedOutputModal, setShowSeedOutputModal] = useState(false)
  const [removeExisting, setRemoveExisting] = useState(false)

  const seedMutation = useMutation({
    mutationFn: (remove: boolean) =>
      apiCall<SeedRbacResponse>(`tools/rbac/seed?remove_existing=${remove}`, { method: 'POST' }),
    onSuccess: () => {
      setShowSeedOutputModal(true)
      setRemoveExisting(false)
    },
    onError: () => {
      setShowSeedOutputModal(true)
      setRemoveExisting(false)
    },
  })

  const handleSeedRbac = useCallback(() => {
    setShowSeedDialog(false)
    seedMutation.mutate(removeExisting)
  }, [seedMutation, removeExisting])

  const seedResult = seedMutation.isError
    ? {
        success: false,
        message: (seedMutation.error as Error).message || 'Failed to seed RBAC',
        output: `Error: ${(seedMutation.error as Error).message || 'Failed to seed RBAC'}`,
      }
    : (seedMutation.data ?? null)

  return {
    showSeedDialog,
    setShowSeedDialog,
    showSeedOutputModal,
    setShowSeedOutputModal,
    removeExisting,
    setRemoveExisting,
    seeding: seedMutation.isPending,
    seedResult,
    handleSeedRbac,
  }
}
