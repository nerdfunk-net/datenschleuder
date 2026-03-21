'use client'

import { useState, useCallback } from 'react'
import { Database, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRedisServersQuery } from './hooks/use-redis-queries'
import { RedisServerCard } from './components/redis-server-card'
import { RedisServerDialog } from './dialogs/redis-server-dialog'
import type { RedisServer } from './types'

const EMPTY_SERVERS: RedisServer[] = []

export function RedisSettingsPage() {
  const { data: servers = EMPTY_SERVERS, isLoading } = useRedisServersQuery()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedServer, setSelectedServer] = useState<RedisServer | null>(null)

  const handleAdd = useCallback(() => {
    setSelectedServer(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((server: RedisServer) => {
    setSelectedServer(server)
    setDialogOpen(true)
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setSelectedServer(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Database className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Redis Servers</h1>
            <p className="text-gray-600 mt-1">
              Manage Redis server connections used by agents and Celery.
            </p>
          </div>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Redis Server
        </Button>
      </div>

      {/* Content Panel */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        {/* Panel header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="text-sm font-medium">Configured Servers</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-100">
              {servers.length} server{servers.length !== 1 ? 's' : ''} configured
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-white hover:bg-white/20 hover:text-white"
              onClick={handleAdd}
              title="Add Redis Server"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Panel body */}
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && servers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No Redis Servers</p>
              <p className="text-sm mt-1">Add a Redis server to get started.</p>
              <Button onClick={handleAdd} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Redis Server
              </Button>
            </div>
          )}

          {!isLoading && servers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {servers.map((server) => (
                <RedisServerCard key={server.id} server={server} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit dialog */}
      <RedisServerDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        server={selectedServer}
      />
    </div>
  )
}
