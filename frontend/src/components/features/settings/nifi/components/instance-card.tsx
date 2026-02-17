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
import { Pencil, Trash2, Plug, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useNifiInstancesMutations } from '../hooks/use-nifi-instances-mutations'
import type { NifiInstance } from '../types'

interface Props {
  instance: NifiInstance
  canWrite: boolean
  onEdit: (instance: NifiInstance) => void
}

function AuthBadge({ instance }: { instance: NifiInstance }) {
  if (instance.oidc_provider_id) {
    return <Badge className="bg-blue-600 text-white hover:bg-blue-700">OIDC: {instance.oidc_provider_id}</Badge>
  }
  if (instance.certificate_name) {
    return <Badge className="bg-cyan-600 text-white hover:bg-cyan-700">Certificate: {instance.certificate_name}</Badge>
  }
  if (instance.username) {
    return <Badge variant="secondary">Username / Password</Badge>
  }
  return <Badge variant="outline" className="text-amber-600 border-amber-300">Not configured</Badge>
}

function SslBadge({ enabled }: { enabled: boolean }) {
  return enabled
    ? <Badge className="bg-green-600 text-white hover:bg-green-700">Enabled</Badge>
    : <Badge variant="secondary">Disabled</Badge>
}

function YesNoBadge({ value }: { value: boolean }) {
  return value
    ? <Badge className="bg-green-600 text-white hover:bg-green-700">Yes</Badge>
    : <Badge className="bg-amber-500 text-white hover:bg-amber-600">No</Badge>
}

export function InstanceCard({ instance, canWrite, onEdit }: Props) {
  const { toast } = useToast()
  const { deleteInstance, testSavedConnection } = useNifiInstancesMutations()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleTestConnection = async () => {
    const result = await testSavedConnection.mutateAsync(instance.id)
    if (result.status === 'success') {
      toast({
        title: 'Connection successful',
        description: `${result.message}${result.details?.version ? ` — Version: ${result.details.version}` : ''}`,
      })
    } else {
      toast({ title: 'Connection failed', description: result.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    await deleteInstance.mutateAsync(instance.id)
    setShowDeleteDialog(false)
  }

  const displayTitle = instance.name
    ? instance.name
    : `${instance.hierarchy_attribute}=${instance.hierarchy_value}`

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
        {/* Card header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white bg-white/20 rounded-full px-3 py-1">
            {displayTitle}
          </span>
          {canWrite && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                title="Test Connection"
                onClick={handleTestConnection}
                disabled={testSavedConnection.isPending}
              >
                {testSavedConnection.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plug className="h-3.5 w-3.5" />
                }
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                title="Edit"
                onClick={() => onEdit(instance)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-red-500/80 hover:text-white"
                title="Delete"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteInstance.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">URL</span>
            <span className="text-xs text-slate-800 text-right break-all max-w-[60%]">{instance.nifi_url}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Username</span>
            <span className="text-xs text-slate-800">{instance.username || 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">SSL</span>
            <SslBadge enabled={instance.use_ssl} />
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Verify SSL</span>
            <YesNoBadge value={instance.verify_ssl} />
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-500">Auth Method</span>
            <AuthBadge instance={instance} />
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NiFi Instance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{displayTitle}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
