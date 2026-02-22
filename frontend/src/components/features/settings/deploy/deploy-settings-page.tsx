'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Loader2, RefreshCw, RotateCcw, Settings, Server } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useApi } from '@/hooks/use-api'
import { useNifiInstancesQuery } from '../nifi/hooks/use-nifi-instances-query'
import type { NifiInstance } from '../nifi/types'
import { useHierarchyQuery } from '../hierarchy/hooks/use-hierarchy-query'
import { useDeploySettingsQuery } from './hooks/use-deploy-settings-query'
import { useDeploySettingsMutations } from './hooks/use-deploy-settings-mutations'
import type { DeploymentSettings, ProcessGroupOption, PathConfig } from './types'
import { DEFAULT_GLOBAL } from './types'
import NextLink from 'next/link'

const EMPTY_INSTANCES: NifiInstance[] = []

export function DeploySettingsPage() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi.settings', 'write')
  const { apiCall } = useApi()

  const { data: hierarchyData } = useHierarchyQuery()
  const { data: instances = EMPTY_INSTANCES, isLoading: loadingInstances } = useNifiInstancesQuery()
  const { data: remoteSettings, isLoading: loadingSettings } = useDeploySettingsQuery()
  const { saveSettings } = useDeploySettingsMutations()

  const topHierarchyName = useMemo(
    () => hierarchyData?.hierarchy?.[0]?.name ?? 'hierarchy',
    [hierarchyData]
  )

  const [globalSettings, setGlobalSettings] = useState({ ...DEFAULT_GLOBAL })
  const [paths, setPaths] = useState<DeploymentSettings['paths']>({})
  const [isDirty, setIsDirty] = useState(false)

  const [pgOptions, setPgOptions] = useState<Record<number, ProcessGroupOption[]>>({})
  const [loadingPgs, setLoadingPgs] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!remoteSettings) return
    setGlobalSettings({ ...DEFAULT_GLOBAL, ...remoteSettings.global })
    const normPaths: DeploymentSettings['paths'] = {}
    for (const [k, v] of Object.entries(remoteSettings.paths ?? {})) {
      normPaths[Number(k)] = v
    }
    setPaths(normPaths)
    setIsDirty(false)
  }, [remoteSettings])

  useEffect(() => {
    if (instances.length === 0) return
    setPaths(prev => {
      const next = { ...prev }
      let changed = false
      for (const inst of instances) {
        if (!next[inst.id]) { next[inst.id] = {}; changed = true }
      }
      return changed ? next : prev
    })
  }, [instances])

  useEffect(() => {
    if (!remoteSettings || instances.length === 0) return
    for (const inst of instances) {
      const saved = remoteSettings.paths?.[inst.id]
      if (saved?.source_path?.id || saved?.dest_path?.id) {
        loadPathsForInstance(inst.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSettings, instances])

  const loadPathsForInstance = useCallback(async (instanceId: number) => {
    setLoadingPgs(prev => ({ ...prev, [instanceId]: true }))
    try {
      const res = await apiCall(
        `nifi/instances/${instanceId}/ops/process-groups/all-paths`
      ) as { process_groups?: Array<{ id: string; name: string; path: string; level: number; formatted_path: string }> }

      const groups = res?.process_groups ?? []
      const options: ProcessGroupOption[] = groups.map(pg => ({
        id: pg.id,
        name: pg.name,
        path: pg.formatted_path,
        raw_path: pg.path,
      }))

      setPgOptions(prev => ({ ...prev, [instanceId]: options }))
    } catch {
      // silently ignore — user can retry
    } finally {
      setLoadingPgs(prev => ({ ...prev, [instanceId]: false }))
    }
  }, [apiCall])

  const handleGlobalChange = useCallback(<K extends keyof typeof DEFAULT_GLOBAL>(
    key: K, value: typeof DEFAULT_GLOBAL[K]
  ) => {
    setGlobalSettings(prev => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }, [])

  const updatePath = useCallback((
    instanceId: number,
    field: 'source_path' | 'dest_path',
    pgId: string
  ) => {
    const options = pgOptions[instanceId] ?? []
    const pg = options.find(o => o.id === pgId)
    setPaths(prev => ({
      ...prev,
      [instanceId]: {
        ...prev[instanceId],
        [field]: pg ? { id: pg.id, path: pg.path, raw_path: pg.raw_path } as PathConfig : undefined,
      },
    }))
    setIsDirty(true)
  }, [pgOptions])

  const handleReset = useCallback(() => {
    if (!remoteSettings) return
    setGlobalSettings({ ...DEFAULT_GLOBAL, ...remoteSettings.global })
    const normPaths: DeploymentSettings['paths'] = {}
    for (const [k, v] of Object.entries(remoteSettings.paths ?? {})) {
      normPaths[Number(k)] = v
    }
    setPaths(normPaths)
    setIsDirty(false)
  }, [remoteSettings])

  const handleSave = useCallback(async () => {
    await saveSettings.mutateAsync({ global: globalSettings, paths })
    setIsDirty(false)
  }, [saveSettings, globalSettings, paths])

  const isLoading = loadingInstances || loadingSettings

  const pageHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Settings className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Deployment Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure deployment parameters for flow deployment
          </p>
        </div>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        {pageHeader}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {pageHeader}

      {/* Global Settings Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">Global Settings</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="space-y-4">
            {/* Process group name template */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 block">
                Process Group Name Template
              </label>
              <Input
                value={globalSettings.process_group_name_template}
                disabled={!canWrite}
                placeholder="{last_hierarchy_value}"
                onChange={e => handleGlobalChange('process_group_name_template', e.target.value)}
                className="max-w-sm"
              />
              <p className="text-xs text-gray-500">
                Default: <code className="bg-slate-100 px-1 rounded">{'{last_hierarchy_value}'}</code> — uses the value of the last hierarchy attribute (e.g. CN value)
              </p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="disable_after_deploy"
                  checked={globalSettings.disable_after_deploy}
                  disabled={!canWrite}
                  onCheckedChange={v => handleGlobalChange('disable_after_deploy', !!v)}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="disable_after_deploy" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Disable flow after deployment
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    DISABLES the deployed process group after deployment (beyond NiFi&apos;s default STOPPED state), preventing accidental starting.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="start_after_deploy"
                  checked={globalSettings.start_after_deploy}
                  disabled={!canWrite}
                  onCheckedChange={v => handleGlobalChange('start_after_deploy', !!v)}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="start_after_deploy" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Start flow after deployment
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    STARTS the deployed process group immediately, allowing it to begin processing data.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="stop_versioning_after_deploy"
                  checked={globalSettings.stop_versioning_after_deploy}
                  disabled={!canWrite}
                  onCheckedChange={v => handleGlobalChange('stop_versioning_after_deploy', !!v)}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="stop_versioning_after_deploy" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Stop versioning after deployment
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Stops version control for the deployed process group after deployment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instance Path Configuration Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">Instance Path Configuration</span>
          </div>
          <div className="text-xs text-blue-100">
            Configure source and destination paths per instance
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {instances.length === 0 ? (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                No NiFi instances configured. Please add instances in{' '}
                <NextLink href="/settings/nifi" className="underline font-medium">Settings / NiFi</NextLink>.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {instances.map(instance => {
                const options = pgOptions[instance.id] ?? []
                const isLoadingPg = !!loadingPgs[instance.id]
                const savedPaths = paths[instance.id]

                const sourceValue = savedPaths?.source_path?.id ?? ''
                const destValue = savedPaths?.dest_path?.id ?? ''

                const toOptions = (saved: PathConfig | undefined) => {
                  const base = options.map(o => ({ value: o.id, label: o.path || o.name }))
                  if (saved?.id && !options.find(o => o.id === saved.id)) {
                    base.unshift({ value: saved.id, label: saved.path || saved.id })
                  }
                  return base
                }

                const srcOptions = toOptions(savedPaths?.source_path)
                const dstOptions = toOptions(savedPaths?.dest_path)

                return (
                  <div
                    key={instance.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4"
                  >
                    {/* Instance label */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <p className="font-semibold text-blue-700 text-sm">
                          {instance.hierarchy_attribute}={instance.hierarchy_value}
                        </p>
                        <p className="text-xs text-muted-foreground">{instance.nifi_url}</p>
                      </div>
                      {canWrite && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isLoadingPg}
                          onClick={() => loadPathsForInstance(instance.id)}
                        >
                          {isLoadingPg
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />}
                          <span className="ml-1.5">Load Paths</span>
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Source path */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600 block">
                          Source Path ({topHierarchyName})
                        </label>
                        <Select
                          value={sourceValue}
                          disabled={!canWrite || (options.length === 0 && !savedPaths?.source_path)}
                          onValueChange={v => updatePath(instance.id, 'source_path', v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={
                              isLoadingPg ? 'Loading…' :
                              options.length === 0 ? 'Click "Load Paths" first' :
                              'Select source path'
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Select a path…</SelectItem>
                            {srcOptions.map(o => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          Search path for the source element in the top hierarchy
                        </p>
                      </div>

                      {/* Destination path */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600 block">
                          Destination Path ({topHierarchyName})
                        </label>
                        <Select
                          value={destValue}
                          disabled={!canWrite || (options.length === 0 && !savedPaths?.dest_path)}
                          onValueChange={v => updatePath(instance.id, 'dest_path', v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={
                              isLoadingPg ? 'Loading…' :
                              options.length === 0 ? 'Click "Load Paths" first' :
                              'Select destination path'
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Select a path…</SelectItem>
                            {dstOptions.map(o => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          Search path for the destination element in the top hierarchy
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      {canWrite && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty || saveSettings.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveSettings.isPending}
          >
            {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      )}
    </div>
  )
}
