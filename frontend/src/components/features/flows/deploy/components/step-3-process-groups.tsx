'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No deployment configurations available. Go back to Step 2 to select targets.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoadingPaths) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-600">Loading process group paths...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Select the target process group for each deployment. The flow will be deployed inside the
        selected process group.
      </p>

      <div className="grid gap-4">
        {deploymentConfigs.map((config) => {
          const hasPaths = config.availablePaths.length > 0

          return (
            <Card key={config.key} className={config.selectedProcessGroupId ? 'border-blue-200' : ''}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{config.flowName}</span>
                    <Badge variant="outline" className="text-xs">
                      {config.target}
                    </Badge>
                  </div>
                  <Badge variant="secondary">{config.hierarchyValue}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Instance Info */}
                {config.instanceId ? (
                  <div className="text-sm text-slate-600">
                    Instance ID: {config.instanceId}
                    {config.templateName && (
                      <span className="ml-3">Template: {config.templateName}</span>
                    )}
                  </div>
                ) : (
                  <Alert className="border-amber-200 bg-amber-50">
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
                        <label className="text-sm font-medium">Process Group</label>
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

                        {/* Suggested Path Hint */}
                        {config.suggestedPath && (
                          <div className="flex items-start gap-2 text-xs text-blue-600">
                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{config.suggestedPath}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert className="border-amber-200 bg-amber-50">
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
                  <div className="rounded-md bg-slate-50 p-3 text-sm">
                    <span className="text-slate-500">Process Group Name:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {config.processGroupName}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
