'use client'

import { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Info } from 'lucide-react'
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
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No deployment configurations available. Go back to configure process groups.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoadingVersions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-600">Loading available versions...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Global Deployment Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Process Group Name Template */}
          <div className="space-y-2">
            <Label htmlFor="pg-name-template">Process Group Name Template</Label>
            <Input
              id="pg-name-template"
              value={deploymentSettings?.global.process_group_name_template || ''}
              onChange={(e) => handleSettingChange('process_group_name_template', e.target.value)}
              placeholder="{last_hierarchy_value}"
            />
            <p className="text-xs text-slate-500">
              Available placeholders: {'{last_hierarchy_value}'}, {'{flow_name}'}, {'{template_name}'}
            </p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="disable-after-deploy"
                checked={deploymentSettings?.global.disable_after_deploy || false}
                onCheckedChange={(checked) =>
                  handleSettingChange('disable_after_deploy', checked === true)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="disable-after-deploy" className="cursor-pointer">
                  Disable after deployment
                </Label>
                <p className="text-xs text-slate-500">
                  Lock the process group after deployment (prevents accidental changes)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="stop-versioning"
                checked={deploymentSettings?.global.stop_versioning_after_deploy || false}
                onCheckedChange={(checked) =>
                  handleSettingChange('stop_versioning_after_deploy', checked === true)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="stop-versioning" className="cursor-pointer">
                  Stop version control after deployment
                </Label>
                <p className="text-xs text-slate-500">
                  Disconnect from registry after deployment
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="start-after-deploy"
                checked={deploymentSettings?.global.start_after_deploy || false}
                onCheckedChange={(checked) =>
                  handleSettingChange('start_after_deploy', checked === true)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="start-after-deploy" className="cursor-pointer">
                  Start process group after deployment
                </Label>
                <p className="text-xs text-slate-500">
                  Automatically start the process group (default: stopped)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Version Selection Per Deployment */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Version Selection</h3>
          <Badge variant="secondary">{deploymentConfigs.length} deployments</Badge>
        </div>

        {deploymentConfigs.map((config) => {
          const hasVersions = config.availableVersions.length > 0
          const selectedVersionObj = config.availableVersions.find(
            (v) => v.version === config.selectedVersion
          )

          return (
            <Card key={config.key}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{config.flowName}</span>
                    <Badge variant="outline" className="text-xs">
                      {config.target}
                    </Badge>
                  </div>
                  <Badge variant="secondary">{config.hierarchyValue}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Template Info */}
                <div className="text-sm text-slate-600">
                  {config.templateName && (
                    <span>Template: {config.templateName}</span>
                  )}
                </div>

                {/* Version Selection */}
                {hasVersions ? (
                  <div className="space-y-2">
                    <Label>Version</Label>
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
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>
                          Created: {new Date(selectedVersionObj.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      No versions available. Latest version will be used automatically.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
