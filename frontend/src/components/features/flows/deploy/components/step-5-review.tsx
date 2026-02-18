'use client'

import { Network, Database, Settings, X, CheckCircle2 } from 'lucide-react'
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
    <div className="space-y-8">
      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-5">
          <Network className="mb-3 h-7 w-7 text-blue-500" />
          <p className="text-sm text-slate-500">Total Flows</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{totalFlows}</p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <Database className="mb-3 h-7 w-7 text-blue-500" />
          <p className="text-sm text-slate-500">Total Deployments</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{totalDeployments}</p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <Settings className="mb-3 h-7 w-7 text-blue-500" />
          <p className="text-sm text-slate-500">Instances Affected</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{totalInstances}</p>
        </div>
      </div>

      {/* Deployment Settings */}
      {deploymentSettings && (
        <div>
          <h3 className="mb-3 text-base font-bold text-slate-900">Deployment Settings</h3>
          <div className="rounded-lg border-2 border-blue-400 bg-slate-50 px-5 py-4 space-y-2">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-semibold text-slate-700">Process Group Name Template:</span>
              <code className="font-mono text-blue-600">
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
      <div>
        <h3 className="mb-3 text-base font-bold text-slate-900">Deployment Details</h3>
        <div className="divide-y rounded-lg border bg-white">
          {deploymentConfigs.map((config) => (
            <div key={config.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-semibold text-slate-900">{config.hierarchyValue}</p>
                {config.processGroupName && config.processGroupName !== config.hierarchyValue && (
                  <p className="mt-0.5 text-xs text-slate-500">{config.processGroupName}</p>
                )}
              </div>
              <span className="text-sm font-semibold tracking-wide text-blue-600 uppercase">
                {config.target}
              </span>
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
      <span className="font-semibold">{label}</span>
      {value ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>Yes</span>
        </>
      ) : (
        <>
          <X className="h-4 w-4 text-slate-400" />
          <span>No</span>
        </>
      )}
    </div>
  )
}
