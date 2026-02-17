'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { DeploymentConfig, DeploymentSettings } from '../types'

interface Step5ReviewProps {
  deploymentConfigs: DeploymentConfig[]
  deploymentSettings: DeploymentSettings | undefined
  onDeploy: () => void
  isDeploying: boolean
}

export function Step5Review({
  deploymentConfigs,
  deploymentSettings,
  onDeploy,
  isDeploying,
}: Step5ReviewProps) {
  // Calculate summary stats
  const totalFlows = new Set(deploymentConfigs.map((c) => c.flowId)).size
  const totalDeployments = deploymentConfigs.length
  const totalInstances = new Set(deploymentConfigs.map((c) => c.instanceId)).size

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Total Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalFlows}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Total Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalDeployments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">Instances Affected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalInstances}</div>
          </CardContent>
        </Card>
      </div>

      {/* Global Settings Summary */}
      {deploymentSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Global Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Process Group Name Template:</span>
              <code className="bg-slate-100 px-2 py-1 rounded text-xs">
                {deploymentSettings.global.process_group_name_template}
              </code>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {deploymentSettings.global.disable_after_deploy && (
                <div className="flex items-center gap-1 text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Disable after deploy
                </div>
              )}
              {deploymentSettings.global.stop_versioning_after_deploy && (
                <div className="flex items-center gap-1 text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Stop versioning
                </div>
              )}
              {deploymentSettings.global.start_after_deploy && (
                <div className="flex items-center gap-1 text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Start after deploy
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployment Configurations Review */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Deployment Configurations</h3>

        {deploymentConfigs.map((config, index) => (
          <Card key={config.key} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">#{index + 1}</span>
                  <span>{config.flowName}</span>
                  <Badge variant="outline" className="text-xs">
                    {config.target}
                  </Badge>
                </div>
                <Badge variant="secondary">{config.hierarchyValue}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Instance ID:</span>
                  <span className="ml-2 font-medium">
                    {config.instanceId || (
                      <span className="text-amber-600">⚠️ Not found</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Template:</span>
                  <span className="ml-2 font-medium">
                    {config.templateName || `ID ${config.templateId}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Process Group:</span>
                  <span className="ml-2 font-medium">{config.processGroupName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Version:</span>
                  <span className="ml-2 font-medium">
                    {config.selectedVersion ? `Version ${config.selectedVersion}` : 'Latest'}
                  </span>
                </div>
              </div>

              {config.parameterContextName && (
                <div className="text-sm">
                  <span className="text-slate-500">Parameter Context:</span>
                  <span className="ml-2 font-medium">{config.parameterContextName}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deployment Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Deployment Order
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800">
          <p>
            Deployments will be executed sequentially. Destination instances will be deployed
            before source instances to ensure receivers are ready before senders start
            transmitting data.
          </p>
        </CardContent>
      </Card>

      {/* Deploy Button */}
      <div className="flex justify-center pt-4">
        <Button onClick={onDeploy} disabled={isDeploying} size="lg" className="w-64">
          {isDeploying ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Deploy All Flows
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
