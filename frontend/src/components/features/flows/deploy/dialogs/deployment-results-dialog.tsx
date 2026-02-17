'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import type { DeploymentResults } from '../types'

interface DeploymentResultsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  results: DeploymentResults
  onClose: () => void
}

export function DeploymentResultsDialog({
  open,
  onOpenChange,
  results,
  onClose,
}: DeploymentResultsDialogProps) {
  const hasFailures = results.failed.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasFailures ? (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Deployment Completed with Errors
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Deployment Successful
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {results.successful.length} of {results.total} deployments completed successfully
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="text-2xl font-bold">{results.total}</div>
              <div className="text-sm text-slate-600">Total</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{results.successful.length}</div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{results.failed.length}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>

          {/* Success List */}
          {results.successful.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Successful Deployments
              </h4>
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {results.successful.map((item) => (
                    <div
                      key={item.config.key}
                      className="flex items-start gap-3 p-2 rounded bg-green-50 border border-green-200"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{item.config.flowName}</div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.config.target}
                          </Badge>
                          <span>→</span>
                          <Badge variant="secondary" className="text-xs">
                            {item.config.hierarchyValue}
                          </Badge>
                          <span className="text-slate-500">
                            Process Group: {item.config.processGroupName}
                          </span>
                        </div>
                        {item.response?.message && (
                          <div className="text-xs text-green-700 mt-1">{item.response.message}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Failure List */}
          {results.failed.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Failed Deployments
              </h4>
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {results.failed.map((item) => (
                    <div
                      key={item.config.key}
                      className="flex items-start gap-3 p-2 rounded bg-red-50 border border-red-200"
                    >
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{item.config.flowName}</div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.config.target}
                          </Badge>
                          <span>→</span>
                          <Badge variant="secondary" className="text-xs">
                            {item.config.hierarchyValue}
                          </Badge>
                          <span className="text-slate-500">
                            Process Group: {item.config.processGroupName}
                          </span>
                        </div>
                        {item.error && (
                          <div className="text-xs text-red-700 mt-1 font-mono bg-red-100 p-2 rounded">
                            {item.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant={hasFailures ? 'destructive' : 'default'}>
            {hasFailures ? 'Close and Review' : 'Done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
