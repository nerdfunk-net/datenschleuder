'use client'

import { Network, Database, Settings, X, CheckCircle2, FileText } from 'lucide-react'
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
}: Step5ReviewProps) {
  const totalFlows = new Set(deploymentConfigs.map((c) => c.flowId)).size
  const totalDeployments = deploymentConfigs.length
  const totalInstances = new Set(deploymentConfigs.map((c) => c.instanceId)).size

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <span className="text-sm font-medium">Total Flows</span>
            </div>
          </div>
          <div className="p-5 bg-gradient-to-b from-white to-gray-50 text-center">
            <p className="text-4xl font-bold text-slate-900">{totalFlows}</p>
          </div>
        </div>

        <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Total Deployments</span>
            </div>
          </div>
          <div className="p-5 bg-gradient-to-b from-white to-gray-50 text-center">
            <p className="text-4xl font-bold text-slate-900">{totalDeployments}</p>
          </div>
        </div>

        <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">Instances Affected</span>
            </div>
          </div>
          <div className="p-5 bg-gradient-to-b from-white to-gray-50 text-center">
            <p className="text-4xl font-bold text-slate-900">{totalInstances}</p>
          </div>
        </div>
      </div>

      {/* Deployment Settings */}
      {deploymentSettings && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">Deployment Settings</span>
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-2">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-medium text-slate-700">Process Group Name Template:</span>
              <code className="font-mono text-sm text-blue-600">
                {deploymentSettings.global.process_group_name_template}
              </code>
            </div>
            <SettingRow
              label="Disable After Deploy:"
              value={deploymentSettings.global.disable_after_deploy}
            />
            <SettingRow
              label="Stop Versioning After Deploy:"
              value={deploymentSettings.global.stop_versioning_after_deploy}
            />
            <SettingRow
              label="Start After Deploy:"
              value={deploymentSettings.global.start_after_deploy}
            />
          </div>
        </div>
      )}

      {/* Deployment Details */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Deployment Details</span>
          </div>
          <div className="text-xs text-blue-100">
            {totalDeployments} deployment{totalDeployments !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-gradient-to-b from-white to-gray-50 rounded-b-lg divide-y">
          {deploymentConfigs.map((config) => (
            <div key={config.key} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{config.flowName}</p>
                    <span className="text-xs font-semibold tracking-wide text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded">
                      {config.target}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Instance: <span className="font-medium">{config.hierarchyValue}</span>
                  </p>
                  {config.processGroupName && config.processGroupName !== config.hierarchyValue && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Process Group: {config.processGroupName}
                    </p>
                  )}
                  {config.parameterContextName && (
                    <p className="mt-0.5 text-xs text-blue-600">
                      Parameter Context: {config.parameterContextName}
                    </p>
                  )}
                  {config.selectedVersion && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Version: {config.selectedVersion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      {value ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-green-700">Yes</span>
        </>
      ) : (
        <>
          <X className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">No</span>
        </>
      )}
    </div>
  )
}
