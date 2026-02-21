'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GitBranch } from 'lucide-react'
import type { ParameterContext } from '../types'

interface BoundProcessGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ParameterContext | null
}

export function BoundProcessGroupsDialog({
  open,
  onOpenChange,
  context,
}: BoundProcessGroupsDialogProps) {
  if (!context) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bound Process Groups</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="text-sm">
            <span className="font-medium text-gray-600">Parameter Context: </span>
            <span className="font-semibold">{context.name}</span>
          </div>

          {context.bound_process_groups && context.bound_process_groups.length > 0 ? (
            <ul className="space-y-2">
              {context.bound_process_groups.map((pg) => (
                <li
                  key={pg.id}
                  className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md"
                >
                  <GitBranch className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{pg.component?.name || 'Unnamed Process Group'}</p>
                    {pg.id && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        ID: <code className="font-mono">{pg.id}</code>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No process groups bound to this parameter context.</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
