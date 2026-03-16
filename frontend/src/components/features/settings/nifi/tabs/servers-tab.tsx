'use client'

import { useState, useCallback, useMemo } from 'react'
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
import { Server, Plus, Loader2, Pencil, Trash2, Settings2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useNifiServersQuery } from '../hooks/use-nifi-servers-query'
import { useNifiServersMutations } from '../hooks/use-nifi-servers-mutations'
import { useNifiInstancesQuery } from '../hooks/use-nifi-instances-query'
import { useNifiClustersQuery } from '../hooks/use-nifi-clusters-query'
import { NifiServerDialog } from '../dialogs/nifi-server-dialog'
import { BootstrapConfigDialog } from '../dialogs/bootstrap-config-dialog'
import type { NifiServer, NifiInstance, NifiCluster } from '../types'
import {
  buildClusterColorMap,
  getServerColorInfo,
  DEFAULT_HEADER_GRADIENT,
  type ClusterColorInfo,
} from '../utils/cluster-colors'

const EMPTY_SERVERS: NifiServer[] = []
const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_CLUSTERS: NifiCluster[] = []

function ServerCard({
  server,
  canWrite,
  onEdit,
  instances,
  clusterInfo,
}: {
  server: NifiServer
  canWrite: boolean
  onEdit: (s: NifiServer) => void
  instances: NifiInstance[]
  clusterInfo: ClusterColorInfo | null
}) {
  const { deleteServer } = useNifiServersMutations()
  const [showDelete, setShowDelete] = useState(false)
  const [showBootstrap, setShowBootstrap] = useState(false)

  const handleDelete = useCallback(async () => {
    await deleteServer.mutateAsync(server.id)
    setShowDelete(false)
  }, [deleteServer, server.id])

  // Find the first linked instance that has a git repo
  const linkedInstance = instances.find(
    (i) => i.server_id === server.id && i.git_config_repo_id != null
  )
  const gitRepoId = linkedInstance?.git_config_repo_id ?? null

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className={`bg-gradient-to-r ${clusterInfo?.gradient ?? DEFAULT_HEADER_GRADIENT} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white bg-white/20 rounded-full px-3 py-1 truncate">
              {server.server_id}
            </span>
            {clusterInfo && (
              <span className="text-[10px] text-white/80 bg-white/15 rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0">
                {clusterInfo.clusterLabel}
              </span>
            )}
          </div>
          {canWrite && (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                        title="Edit Bootstrap"
                        onClick={() => setShowBootstrap(true)}
                        disabled={gitRepoId == null}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {gitRepoId == null && (
                    <TooltipContent>No linked instance with a git config repo</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                title="Edit"
                onClick={() => onEdit(server)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-red-500/80 hover:text-white"
                title="Delete"
                onClick={() => setShowDelete(true)}
                disabled={deleteServer.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Hostname</span>
            <span className="text-xs text-slate-800 text-right break-all max-w-[60%]">{server.hostname}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">SSH Credential</span>
            {server.credential_name ? (
              <Badge variant="secondary">{server.credential_name}</Badge>
            ) : (
              <span className="text-xs text-slate-400">None</span>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NiFi Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete server <strong>{server.server_id}</strong>? This action cannot be undone.
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

      <BootstrapConfigDialog
        open={showBootstrap}
        onOpenChange={setShowBootstrap}
        repoId={gitRepoId}
        serverName={server.server_id}
      />
    </>
  )
}

export function ServersTab() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi', 'write')

  const { data: servers = EMPTY_SERVERS, isLoading } = useNifiServersQuery()
  const { data: instances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const { data: clusters = EMPTY_CLUSTERS } = useNifiClustersQuery()
  const clusterColorMap = useMemo(() => buildClusterColorMap(clusters), [clusters])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<NifiServer | null>(null)

  const handleAdd = useCallback(() => {
    setEditingServer(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((server: NifiServer) => {
    setEditingServer(server)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingServer(null)
  }, [])

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">NiFi Servers</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-blue-100">
            {servers.length} server{servers.length !== 1 ? 's' : ''} configured
          </span>
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-white hover:bg-white/20 hover:text-white"
              onClick={handleAdd}
              title="Add Server"
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

        {!isLoading && servers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Server className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No NiFi Servers</p>
            <p className="text-sm mt-1">
              {canWrite
                ? 'Add your first server to get started.'
                : 'No servers configured yet.'}
            </p>
            {canWrite && (
              <Button onClick={handleAdd} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Server
              </Button>
            )}
          </div>
        )}

        {!isLoading && servers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {servers.map(server => (
              <ServerCard
                key={server.id}
                server={server}
                canWrite={canWrite}
                onEdit={handleEdit}
                instances={instances}
                clusterInfo={getServerColorInfo(server.id, instances, clusters, clusterColorMap)}
              />
            ))}
          </div>
        )}
      </div>

      <NifiServerDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        server={editingServer}
      />
    </div>
  )
}
