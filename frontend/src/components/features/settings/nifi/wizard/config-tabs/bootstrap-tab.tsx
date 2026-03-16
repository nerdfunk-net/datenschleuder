'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useWizardStore } from '../wizard-store'

export function BootstrapTab() {
  const bootstrapConfig = useWizardStore((s) => s.bootstrapConfig)
  const updateBootstrapConfig = useWizardStore((s) => s.updateBootstrapConfig)

  const handleChange = useCallback(
    (field: string, value: string | boolean) => {
      updateBootstrapConfig({ [field]: value })
    },
    [updateBootstrapConfig]
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-700">Bootstrap Configuration</h3>
        <p className="text-xs text-muted-foreground mt-1">
          These settings will be applied to bootstrap.conf for all instances in the cluster.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="min-ram">Minimum RAM (-Xms)</Label>
            <Input
              id="min-ram"
              placeholder="e.g. 1g, 512m"
              value={bootstrapConfig.minRam}
              onChange={(e) => handleChange('minRam', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="max-ram">Maximum RAM (-Xmx)</Label>
            <Input
              id="max-ram"
              placeholder="e.g. 4g, 2048m"
              value={bootstrapConfig.maxRam}
              onChange={(e) => handleChange('maxRam', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="run-as">Run As User (optional)</Label>
            <Input
              id="run-as"
              placeholder="e.g. nifi"
              value={bootstrapConfig.runAs}
              onChange={(e) => handleChange('runAs', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              id="preserve-env"
              checked={bootstrapConfig.preserveEnvironment}
              onCheckedChange={(v) => handleChange('preserveEnvironment', v)}
            />
            <Label htmlFor="preserve-env">Preserve Environment</Label>
          </div>
        </div>
      </div>
    </div>
  )
}
