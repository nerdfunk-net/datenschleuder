'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Network, ChevronRight } from 'lucide-react'
import type { NifiInstance } from '../types'

interface CheckAllDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instances: NifiInstance[]
  loading: boolean
  onSelectInstance: (instanceId: number) => void
}

export function CheckAllDialog({
  open,
  onOpenChange,
  instances,
  loading,
  onSelectInstance,
}: CheckAllDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-blue-600" />
            Select NiFi Instance
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Select a NiFi instance to check all flows:
          </p>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && instances.length === 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-800">
                No NiFi instances found.
              </AlertDescription>
            </Alert>
          )}

          {!loading && instances.length > 0 && (
            <div className="space-y-2">
              {instances.map((instance) => (
                <button
                  key={instance.id}
                  type="button"
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors flex items-center justify-between"
                  onClick={() => {
                    onSelectInstance(instance.id)
                    onOpenChange(false)
                  }}
                >
                  <div>
                    <p className="font-semibold text-slate-900">{instance.hierarchy_value}</p>
                    <p className="text-xs text-muted-foreground">{instance.nifi_url}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
