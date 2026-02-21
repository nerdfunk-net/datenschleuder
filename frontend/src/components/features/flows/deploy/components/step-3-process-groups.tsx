'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { DeploymentConfig } from '../types'
import { formatPathForDisplay } from '../utils/deployment-config-utils'

interface Step3ProcessGroupsProps {
  deploymentConfigs: DeploymentConfig[]
  onUpdateProcessGroup: (configKey: string, processGroupId: string) => void
  isLoadingPaths: boolean
}

export function Step3ProcessGroups({
  deploymentConfigs,
  onUpdateProcessGroup,
  isLoadingPaths,
}: Step3ProcessGroupsProps) {
  if (deploymentConfigs.length === 0) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          No deployment configurations available. Go back to Step 2 to select targets.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoadingPaths) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Loading process group paths...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Select the target process group for each deployment. The flow will be deployed inside the
        selected process group.
      </p>

      <div className="grid gap-4">
        {deploymentConfigs.map((config) => {
          const hasPaths = config.availablePaths.length > 0

          return (
            <div key={config.key} className="shadow-lg border-0 p-0 bg-white rounded-lg">
              {/* Config gradient header */}
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{config.flowName}</span>
                  <Badge className="bg-white/20 text-white border-white/30 text-xs">
                    {config.target}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/20 text-white border-white/30 text-xs">
                    {config.hierarchyValue}
                  </Badge>
                  {config.selectedProcessGroupId && (
                    <Badge className="bg-green-500/80 text-white border-green-400/30 text-xs">
                      ✓ Configured
                    </Badge>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
                {/* Instance Info */}
                {config.instanceId ? (
                  <p className="text-xs text-gray-500">
                    Instance ID: {config.instanceId}
                    {config.templateName && (
                      <span className="ml-3">Template: {config.templateName}</span>
                    )}
                  </p>
                ) : (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      No NiFi instance found for hierarchy value &ldquo;{config.hierarchyValue}&rdquo;
                    </AlertDescription>
                  </Alert>
                )}

                {/* Process Group Selection */}
                {config.instanceId && (
                  <>
                    {hasPaths ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Process Group</label>
                        <Select
                          value={config.selectedProcessGroupId}
                          onValueChange={(value) => onUpdateProcessGroup(config.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select process group..." />
                          </SelectTrigger>
                          <SelectContent>
                            {config.availablePaths.map((path) => (
                              <SelectItem key={path.id} value={path.id}>
                                {formatPathForDisplay(path)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {config.suggestedPath && (
                          <div className="flex items-start gap-2 text-xs text-blue-600">
                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{config.suggestedPath}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          No process groups available for this instance
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                {/* Generated Process Group Name Preview */}
                {config.selectedProcessGroupId && (
                  <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm">
                    <span className="text-slate-500">Process Group Name:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {config.processGroupName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
