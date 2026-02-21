'use client'

import { useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Info, Settings } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { DeploymentConfig, DeploymentSettings } from '../types'

interface Step4SettingsProps {
  deploymentConfigs: DeploymentConfig[]
  deploymentSettings: DeploymentSettings | undefined
  onUpdateVersion: (configKey: string, version: number | null) => void
  onUpdateSettings: (settings: DeploymentSettings) => void
  isLoadingVersions: boolean
}

export function Step4Settings({
  deploymentConfigs,
  deploymentSettings,
  onUpdateVersion,
  onUpdateSettings,
  isLoadingVersions,
}: Step4SettingsProps) {
  const handleVersionChange = useCallback(
    (configKey: string, value: string) => {
      const version = value === 'latest' ? null : parseInt(value, 10)
      onUpdateVersion(configKey, version)
    },
    [onUpdateVersion]
  )

  const handleSettingChange = useCallback(
    (key: keyof DeploymentSettings['global'], value: boolean | string) => {
      if (!deploymentSettings) return
      onUpdateSettings({
        ...deploymentSettings,
        global: {
          ...deploymentSettings.global,
          [key]: value,
        },
      })
    },
    [deploymentSettings, onUpdateSettings]
  )

  if (deploymentConfigs.length === 0) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          No deployment configurations available. Go back to configure process groups.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoadingVersions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Loading available versions...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">Global Deployment Settings</span>
          </div>
          <div className="text-xs text-blue-100">Applied to all deployments</div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* Process Group Name Template */}
          <div className="space-y-2">
            <Label htmlFor="pg-name-template" className="text-sm font-medium">
              Process Group Name Template
            </Label>
            <Input
              id="pg-name-template"
              value={deploymentSettings?.global.process_group_name_template || ''}
              onChange={(e) => handleSettingChange('process_group_name_template', e.target.value)}
              placeholder="{last_hierarchy_value}"
            />
            <p className="text-xs text-gray-500">
              Available placeholders: {'{last_hierarchy_value}'}, {'{flow_name}'}, {'{template_name}'}
            </p>
          </div>

          {/* Switches */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
              <Switch
                id="disable-after-deploy"
                checked={deploymentSettings?.global.disable_after_deploy || false}
                onCheckedChange={(checked) =>
                  handleSettingChange('disable_after_deploy', checked)
                }
              />
              <div className="flex-1">
                <Label htmlFor="disable-after-deploy" className="text-sm font-medium cursor-pointer">
                  Disable after deployment
                </Label>
                <p className="text-xs text-gray-600 mt-0.5">
                  Lock the process group after deployment (prevents accidental changes)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
              <Switch
                id="stop-versioning"
                checked={deploymentSettings?.global.stop_versioning_after_deploy || false}
                onCheckedChange={(checked) =>
                  handleSettingChange('stop_versioning_after_deploy', checked)
                }
              />
              <div className="flex-1">
                <Label htmlFor="stop-versioning" className="text-sm font-medium cursor-pointer">
                  Stop version control after deployment
                </Label>
                <p className="text-xs text-gray-600 mt-0.5">
                  Disconnect from registry after deployment
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
              <Switch
                id="start-after-deploy"
                checked={deploymentSettings?.global.start_after_deploy || false}
                onCheckedChange={(checked) =>
                  handleSettingChange('start_after_deploy', checked)
                }
              />
              <div className="flex-1">
                <Label htmlFor="start-after-deploy" className="text-sm font-medium cursor-pointer">
                  Start process group after deployment
                </Label>
                <p className="text-xs text-gray-600 mt-0.5">
                  Automatically start the process group (default: stopped)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version Selection Per Deployment */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">Version Selection</h3>
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">{deploymentConfigs.length} deployments</Badge>
        </div>

        {deploymentConfigs.map((config) => {
          const hasVersions = config.availableVersions.length > 0
          const selectedVersionObj = config.availableVersions.find(
            (v) => v.version === config.selectedVersion
          )

          return (
            <div key={config.key} className="shadow-lg border-0 p-0 bg-white rounded-lg">
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{config.flowName}</span>
                  <Badge className="bg-white/20 text-white border-white/30 text-xs">
                    {config.target}
                  </Badge>
                </div>
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  {config.hierarchyValue}
                </Badge>
              </div>
              <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-3">
                {config.templateName && (
                  <p className="text-xs text-gray-500">Template: {config.templateName}</p>
                )}

                {hasVersions ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Version</Label>
                    <Select
                      value={config.selectedVersion?.toString() || 'latest'}
                      onValueChange={(value) => handleVersionChange(config.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="latest">
                          Latest (automatic) - Version {config.availableVersions[0]?.version}
                        </SelectItem>
                        {config.availableVersions.map((version) => (
                          <SelectItem key={version.version} value={version.version.toString()}>
                            Version {version.version}
                            {version.comments && ` - ${version.comments}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedVersionObj && (
                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>
                          Created: {new Date(selectedVersionObj.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      No versions available. Latest version will be used automatically.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
