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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Trash2, RefreshCw, XCircle } from 'lucide-react'
import type { ConflictInfo, DeploymentConfig } from '../types'

interface ConflictResolutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictInfo: ConflictInfo | null
  deploymentConfig: DeploymentConfig | null
  onSkip: () => void
  onDelete: () => void
  onUpdateVersion: () => void
  isResolving: boolean
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflictInfo,
  deploymentConfig,
  onSkip,
  onDelete,
  onUpdateVersion,
  isResolving,
}: ConflictResolutionDialogProps) {
  if (!conflictInfo || !deploymentConfig) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Process Group Already Exists
          </DialogTitle>
          <DialogDescription>
            A process group with the same name already exists at the target location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deployment Info */}
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Flow Name:</span>
              <span className="text-sm">{deploymentConfig.flowName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Target Instance:</span>
              <Badge variant="secondary">{deploymentConfig.hierarchyValue}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Process Group Name:</span>
              <code className="text-xs bg-white px-2 py-1 rounded">
                {deploymentConfig.processGroupName}
              </code>
            </div>
          </div>

          {/* Existing Process Group Info */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Existing Process Group Details:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-600">Name:</span>
                    <span className="ml-2 font-medium">{conflictInfo.existing_process_group.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">ID:</span>
                    <code className="ml-2 text-xs">{conflictInfo.existing_process_group.id}</code>
                  </div>
                  <div>
                    <span className="text-slate-600">Running Processors:</span>
                    <Badge variant="default" className="ml-2">
                      {conflictInfo.existing_process_group.running_count}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-600">Stopped Processors:</span>
                    <Badge variant="secondary" className="ml-2">
                      {conflictInfo.existing_process_group.stopped_count}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-600">Version Control:</span>
                    <span className="ml-2">
                      {conflictInfo.existing_process_group.has_version_control ? (
                        <Badge variant="outline">Under version control</Badge>
                      ) : (
                        <span className="text-slate-500">Not under version control</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Resolution Options */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">How would you like to proceed?</h4>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onSkip}
                disabled={isResolving}
              >
                <XCircle className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Skip This Deployment</div>
                  <div className="text-xs text-slate-500">
                    Mark as failed and continue with remaining deployments
                  </div>
                </div>
              </Button>

              {conflictInfo.existing_process_group.has_version_control &&
                deploymentConfig.registryId &&
                deploymentConfig.bucketId &&
                deploymentConfig.flowIdRegistry && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={onUpdateVersion}
                    disabled={isResolving}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Update to New Version</div>
                      <div className="text-xs text-slate-500">
                        Change version of existing process group to{' '}
                        {deploymentConfig.selectedVersion
                          ? `v${deploymentConfig.selectedVersion}`
                          : 'latest'}
                      </div>
                    </div>
                  </Button>
                )}

              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={onDelete}
                disabled={isResolving}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Delete and Re-Deploy</div>
                  <div className="text-xs">
                    Remove existing process group and deploy fresh copy
                  </div>
                </div>
              </Button>
            </div>
          </div>

          {/* Warning for running processors */}
          {conflictInfo.existing_process_group.running_count > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This process group has {conflictInfo.existing_process_group.running_count}{' '}
                running {conflictInfo.existing_process_group.running_count === 1 ? 'processor' : 'processors'}. Deleting
                will stop all data flow.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isResolving}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
