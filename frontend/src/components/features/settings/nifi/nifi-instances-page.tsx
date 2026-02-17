'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Server, Plus } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useNifiInstancesQuery } from './hooks/use-nifi-instances-query'
import { InstanceCard } from './components/instance-card'
import { NifiInstanceDialog } from './dialogs/nifi-instance-dialog'
import type { NifiInstance } from './types'

export function NifiInstancesPage() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi', 'write')

  const { data: instances = [], isLoading, error } = useNifiInstancesQuery()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState<NifiInstance | null>(null)

  const handleAdd = useCallback(() => {
    setEditingInstance(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((instance: NifiInstance) => {
    setEditingInstance(instance)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingInstance(null)
  }, [])

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Failed to load NiFi instances. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      {(instances.length > 0 || canWrite) && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">NiFi Instances</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage multiple NiFi instances, one for each top hierarchy value
            </p>
          </div>
          {canWrite && (
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add NiFi Instance
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {instances.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <Server className="h-12 w-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No NiFi Instances</h3>
          <p className="text-sm text-slate-500 mb-4">
            {canWrite
              ? 'Add your first NiFi instance to get started.'
              : 'No NiFi instances configured yet.'}
          </p>
          {canWrite && (
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add NiFi Instance
            </Button>
          )}
        </div>
      )}

      {/* Instance grid */}
      {instances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {instances.map(instance => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              canWrite={canWrite}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <NifiInstanceDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        instance={editingInstance}
      />
    </div>
  )
}
