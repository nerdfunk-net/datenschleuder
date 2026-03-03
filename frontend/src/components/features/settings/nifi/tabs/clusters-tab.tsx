'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Network, Plus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useNifiClustersQuery } from '../hooks/use-nifi-clusters-query'
import { useNifiClustersMutations } from '../hooks/use-nifi-clusters-mutations'
import { NifiClusterDialog } from '../dialogs/nifi-cluster-dialog'
import type { NifiCluster } from '../types'

const EMPTY_CLUSTERS: NifiCluster[] = []

function ClusterCard({
  cluster,
  canWrite,
  onEdit,
}: {
  cluster: NifiCluster
  canWrite: boolean
  onEdit: (c: NifiCluster) => void
}) {
  const { deleteCluster } = useNifiClustersMutations()
  const [showDelete, setShowDelete] = useState(false)

  const handleDelete = useCallback(async () => {
    await deleteCluster.mutateAsync(cluster.id)
    setShowDelete(false)
  }, [deleteCluster, cluster.id])

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white bg-white/20 rounded-full px-3 py-1">
            {cluster.cluster_id}
          </span>
          {canWrite && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                title="Edit"
                onClick={() => onEdit(cluster)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-red-500/80 hover:text-white"
                title="Delete"
                onClick={() => setShowDelete(true)}
                disabled={deleteCluster.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Hierarchy</span>
            <span className="text-xs text-slate-800">
              {cluster.hierarchy_attribute} = {cluster.hierarchy_value}
            </span>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-500 mb-2">
              Instances ({cluster.members.length})
            </p>
            <div className="space-y-1">
              {cluster.members.map(m => (
                <div key={m.instance_id} className="flex items-center justify-between">
                  <span className="text-xs text-slate-700 truncate max-w-[120px]">
                    {m.name || m.nifi_url}
                  </span>
                  <div className="flex items-center gap-1">
                    {m.name && (
                      <span className="text-xs text-slate-400 truncate max-w-[80px]">{m.nifi_url}</span>
                    )}
                    {m.is_primary && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                        Primary
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NiFi Cluster</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete cluster <strong>{cluster.cluster_id}</strong>?
              The instances will not be deleted, only the cluster association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ClustersTab() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi', 'write')

  const { data: clusters = EMPTY_CLUSTERS, isLoading } = useNifiClustersQuery()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCluster, setEditingCluster] = useState<NifiCluster | null>(null)

  const handleAdd = useCallback(() => {
    setEditingCluster(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((cluster: NifiCluster) => {
    setEditingCluster(cluster)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingCluster(null)
  }, [])

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4" />
          <span className="text-sm font-medium">NiFi Clusters</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-blue-100">{clusters.length !== 1 ? 's' : ''} configured
          </span>
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-white hover:bg-white/20 hover:text-white"
              onClick={handleAdd}
              title="Add Cluster"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && clusters.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Network className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No NiFi Clusters</p>
            <p className="text-sm mt-1">
              {canWrite
                ? 'Add your first cluster to group servers together.'
                : 'No clusters configured yet.'}
            </p>
            {canWrite && (
              <Button onClick={handleAdd} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Cluster
              </Button>
            )}
          </div>
        )}

        {!isLoading && clusters.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {clusters.map(cluster => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                canWrite={canWrite}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      <NifiClusterDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        cluster={editingCluster}
      />
    </div>
  )
}
