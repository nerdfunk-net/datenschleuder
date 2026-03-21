'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Loader2, Lock, Pencil, Plug, Trash2 } from 'lucide-react'
import { useRedisServerMutations } from '../hooks/use-redis-mutations'
import type { RedisServer } from '../types'

interface RedisServerCardProps {
  server: RedisServer
  onEdit: (server: RedisServer) => void
}

export function RedisServerCard({ server, onEdit }: RedisServerCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { deleteServer, testConnection } = useRedisServerMutations()

  function handleConfirmDelete() {
    deleteServer.mutate(server.id, { onSuccess: () => setDeleteOpen(false) })
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
        {/* Card header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white bg-white/20 rounded-full px-3 py-1 truncate">
            {server.name}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
              title="Test Connection"
              onClick={() => testConnection.mutate(server.id)}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Plug className="h-3.5 w-3.5" />}
            </Button>
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
              title="Remove"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteServer.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Card body */}
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Host</span>
            <span className="text-xs text-slate-800 font-mono">
              {server.host}:{server.port}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">TLS</span>
            {server.use_tls
              ? <Badge className="bg-green-600 text-white hover:bg-green-700">Enabled</Badge>
              : <Badge variant="secondary">Disabled</Badge>
            }
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">DB Index</span>
            <span className="text-xs text-slate-800">{server.db_index}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Password</span>
            {server.has_password
              ? (
                <span className="flex items-center gap-1 text-xs text-slate-800">
                  <Lock className="h-3 w-3" /> Set
                </span>
              )
              : <span className="text-xs text-slate-400">Not set</span>
            }
          </div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Redis Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{server.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteServer.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteServer.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
