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
import { XCircle, GitBranch } from 'lucide-react'
import type { ParameterContext } from '../types'

interface DeleteErrorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ParameterContext | null
  errorMessage: string
  onViewBoundGroups: () => void
}

export function DeleteErrorDialog({
  open,
  onOpenChange,
  context,
  errorMessage,
  onViewBoundGroups,
}: DeleteErrorDialogProps) {
  if (!context) return null

  const hasBoundGroups = context.bound_process_groups && context.bound_process_groups.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Cannot Delete Parameter Context
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Context info */}
          <div className="p-3 bg-gray-50 border-l-4 border-red-500 rounded-sm space-y-1">
            <div className="flex gap-2 text-sm">
              <span className="font-semibold text-gray-600 min-w-32">Parameter Context:</span>
              <span className="font-bold">{context.name}</span>
            </div>
            {context.description && (
              <div className="flex gap-2 text-sm">
                <span className="font-semibold text-gray-600 min-w-32">Description:</span>
                <span className="text-gray-600">{context.description}</span>
              </div>
            )}
          </div>

          {/* Error message */}
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
          </Alert>

          {/* Bound process groups */}
          {hasBoundGroups && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-sm text-sm text-amber-800">
                <GitBranch className="h-4 w-4 flex-shrink-0" />
                <span>
                  This parameter context is bound to{' '}
                  <strong>{context.bound_process_groups!.length}</strong> process group(s).
                </span>
              </div>

              <ul className="space-y-1.5">
                {context.bound_process_groups!.map((pg) => (
                  <li
                    key={pg.id}
                    className="flex items-start gap-2 p-2.5 bg-white border-2 border-red-300 rounded-md"
                  >
                    <GitBranch className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">
                        {pg.component?.name || 'Unnamed Process Group'}
                      </p>
                      {pg.id && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          ID: <code className="font-mono">{pg.id}</code>
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-sm text-sm text-blue-800 space-y-1">
                <p className="font-semibold">How to resolve:</p>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                  <li>Unbind this parameter context from all process groups in NiFi</li>
                  <li>Or delete/modify the process groups that reference it</li>
                  <li>Then try deleting this parameter context again</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {hasBoundGroups && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onViewBoundGroups()
              }}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              View Bound Process Groups
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
