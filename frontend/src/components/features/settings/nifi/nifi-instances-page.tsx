'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Server, Plus, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useNifiInstancesQuery } from './hooks/use-nifi-instances-query'
import { InstanceCard } from './components/instance-card'
import { NifiInstanceDialog } from './dialogs/nifi-instance-dialog'
import type { NifiInstance } from './types'

const EMPTY_INSTANCES: NifiInstance[] = []

export function NifiInstancesPage() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi', 'write')

  const { data: instances = EMPTY_INSTANCES, isLoading, error } = useNifiInstancesQuery()

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

  const pageHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Server className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">NiFi Instances</h1>
          <p className="text-muted-foreground mt-2">
            Manage multiple NiFi instances, one for each top hierarchy value
          </p>
        </div>
      </div>
      {canWrite && (
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add NiFi Instance
        </Button>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Failed to load NiFi instances. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      {/* Main Content Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">Configured Instances</span>
          </div>
          <div className="text-xs text-blue-100">
            {instances.length} instance{instances.length !== 1 ? 's' : ''} configured
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {/* Empty state */}
          {instances.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No NiFi Instances</p>
              <p className="text-sm mt-1">
                {canWrite
                  ? 'Add your first NiFi instance to get started.'
                  : 'No NiFi instances configured yet.'}
              </p>
              {canWrite && (
                <Button onClick={handleAdd} className="mt-4">
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
        </div>
      </div>

      <NifiInstanceDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        instance={editingInstance}
      />
    </div>
  )
}
