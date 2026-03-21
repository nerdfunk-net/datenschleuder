'use client'

import { useState, type ReactNode } from 'react'
import { Input as _Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react'
import type { NifiCluster } from '@/components/features/settings/nifi/types'
import type { RegistryFlow } from '@/components/features/flows/manage/types'
import type { PathStatus, ParameterContext } from '../types'

export interface PathSectionProps {
  title: string
  icon: ReactNode
  gradientClass: string
  clusters: NifiCluster[]
  selectedClusterId: number | null
  onClusterChange: (id: number | null) => void
  pathStatuses: PathStatus[]
  isLoadingPaths: boolean
  hasChecked: boolean
  registryFlows: RegistryFlow[]
  isLoadingFlows: boolean
  paramContexts: ParameterContext[]
  isLoadingParams: boolean
  deployingPaths: Set<string>
  onDeploy: (path: string, flowId: number, paramContextId: string | null) => void
  onReload: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function PathSection({
  title,
  icon,
  gradientClass,
  clusters,
  selectedClusterId,
  onClusterChange,
  pathStatuses,
  isLoadingPaths,
  hasChecked,
  registryFlows,
  isLoadingFlows,
  paramContexts,
  isLoadingParams,
  deployingPaths,
  onDeploy,
  onReload,
  collapsed,
  onToggleCollapse,
}: PathSectionProps) {
  const [selectedFlows, setSelectedFlows] = useState<Record<string, string>>({})
  const [selectedParams, setSelectedParams] = useState<Record<string, string>>({})

  const missingCount = pathStatuses.filter((s) => !s.exists).length
  const existingCount = pathStatuses.filter((s) => s.exists).length

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Gradient header */}
      <div
        className={`${gradientClass} text-white py-2 px-4 flex items-center justify-between rounded-t-lg cursor-pointer`}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center space-x-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {hasChecked && pathStatuses.length > 0 && (
            <span className="text-xs text-white/80">
              {existingCount}/{pathStatuses.length} ok
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20"
            disabled={!selectedClusterId || isLoadingPaths}
            onClick={onReload}
          >
            {isLoadingPaths ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Reload paths
          </Button>
        </div>
      </div>

      {/* Collapsible content */}
      {!collapsed && (
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          <p className="text-sm text-gray-600">
            Check if process groups exist for the flow hierarchy. The last hierarchy item will not
            be checked.
          </p>

          {/* Cluster selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Select NiFi Cluster</label>
            <Select
              value={selectedClusterId?.toString() ?? ''}
              onValueChange={(v) => onClusterChange(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a cluster..." />
              </SelectTrigger>
              <SelectContent>
                {clusters.map((cluster) => (
                  <SelectItem key={cluster.id} value={cluster.id.toString()}>
                    {cluster.hierarchy_value} ({cluster.cluster_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading state */}
          {isLoadingPaths && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-600">Checking paths...</span>
            </div>
          )}

          {/* Path status list */}
          {!isLoadingPaths && hasChecked && pathStatuses.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
              {pathStatuses.map((ps) => (
                <div key={ps.path} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {/* Status + path */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {ps.exists ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                      <code className="font-mono text-sm text-gray-800 truncate">{ps.path}</code>
                      {ps.exists ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300 flex-shrink-0 text-xs">
                          Exists
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-300 flex-shrink-0 text-xs">
                          Missing
                        </Badge>
                      )}
                    </div>

                    {/* Deploy controls — missing paths only */}
                    {!ps.exists && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Parameter context */}
                        <Select
                          value={selectedParams[ps.path] ?? 'none'}
                          onValueChange={(v) =>
                            setSelectedParams((prev) => ({ ...prev, [ps.path]: v }))
                          }
                          disabled={isLoadingParams}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {paramContexts.map((ctx) => (
                              <SelectItem key={ctx.id} value={ctx.id}>
                                {ctx.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Registry flow */}
                        <Select
                          value={selectedFlows[ps.path] ?? ''}
                          onValueChange={(v) =>
                            setSelectedFlows((prev) => ({ ...prev, [ps.path]: v }))
                          }
                          disabled={isLoadingFlows || registryFlows.length === 0}
                        >
                          <SelectTrigger className="w-60 h-8 text-xs">
                            <SelectValue placeholder="Select a flow..." />
                          </SelectTrigger>
                          <SelectContent>
                            {registryFlows.map((flow) => (
                              <SelectItem key={flow.id} value={flow.id.toString()}>
                                {flow.flow_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Deploy button */}
                        <Button
                          size="sm"
                          className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                          disabled={!selectedFlows[ps.path] || deployingPaths.has(ps.path)}
                          onClick={() => {
                            const flowId = Number(selectedFlows[ps.path])
                            const rawParam = selectedParams[ps.path]
                            const paramId =
                              rawParam && rawParam !== 'none' ? rawParam : null
                            onDeploy(ps.path, flowId, paramId)
                          }}
                          title="Deploy flow to create this process group"
                        >
                          {deployingPaths.has(ps.path) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Prompt: no check run yet */}
          {!isLoadingPaths && !hasChecked && selectedClusterId && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Click <strong>Reload paths</strong> to check process group status for this
                cluster.
              </AlertDescription>
            </Alert>
          )}

          {/* Prompt: select a cluster */}
          {!selectedClusterId && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Select a NiFi cluster to get started.
              </AlertDescription>
            </Alert>
          )}

          {/* Warning: no registry flows */}
          {!isLoadingPaths && hasChecked && registryFlows.length === 0 && missingCount > 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No registry flows found for this instance. Please add flows in the Registry section
                first.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
