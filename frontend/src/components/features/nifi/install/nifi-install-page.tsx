'use client'

import { useState, useCallback } from 'react'
import {
  Download,
  Upload,
  HardDriveDownload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  RefreshCw,
} from 'lucide-react'
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
import { useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import {
  useCheckPathQuery,
  useParameterContextsQuery,
  useRegistryFlowsByInstanceQuery,
} from './hooks/use-install-query'
import { useDeployFlowMutation } from './hooks/use-install-mutations'
import type { NifiInstance } from '@/components/features/settings/nifi/types'
import type { RegistryFlow } from '@/components/features/flows/manage/types'
import type { PathStatus, ParameterContext } from './types'

// Stable empty defaults (prevent re-render loops)
const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_REGISTRY_FLOWS: RegistryFlow[] = []
const EMPTY_PARAM_CONTEXTS: ParameterContext[] = []

// ============================================================================
// PathSection — presentational collapsible panel
// ============================================================================

interface PathSectionProps {
  title: string
  icon: React.ReactNode
  gradientClass: string
  instances: NifiInstance[]
  selectedInstanceId: number | null
  onInstanceChange: (id: number | null) => void
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

function PathSection({
  title,
  icon,
  gradientClass,
  instances,
  selectedInstanceId,
  onInstanceChange,
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
            disabled={!selectedInstanceId || isLoadingPaths}
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

          {/* Instance selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Select NiFi Instance</label>
            <Select
              value={selectedInstanceId?.toString() ?? ''}
              onValueChange={(v) => onInstanceChange(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select an instance..." />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id.toString()}>
                    {inst.hierarchy_value} — {inst.nifi_url}
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
          {!isLoadingPaths && !hasChecked && selectedInstanceId && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Click <strong>Reload paths</strong> to check process group status for this
                instance.
              </AlertDescription>
            </Alert>
          )}

          {/* Prompt: select an instance */}
          {!selectedInstanceId && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Select a NiFi instance to get started.
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

// ============================================================================
// SectionWrapper — owns state and data-fetching for one panel
// ============================================================================

interface SectionWrapperProps {
  instances: NifiInstance[]
  pathType: 'source' | 'destination'
  title: string
  icon: React.ReactNode
  gradientClass: string
  onDeployRequest: (
    instanceId: number,
    path: string,
    flowId: number,
    paramContextId: string | null,
  ) => Promise<void>
  deployingPaths: Set<string>
}

function SectionWrapper({
  instances,
  pathType,
  title,
  icon,
  gradientClass,
  onDeployRequest,
  deployingPaths,
}: SectionWrapperProps) {
  const [instanceId, setInstanceId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  const { data: pathData, isLoading: isLoadingPaths, refetch } = useCheckPathQuery(
    instanceId,
    pathType,
    false, // never auto-fetch
  )
  const { data: registryFlows = EMPTY_REGISTRY_FLOWS, isLoading: isLoadingFlows } =
    useRegistryFlowsByInstanceQuery(instanceId)
  const { data: paramContexts = EMPTY_PARAM_CONTEXTS, isLoading: isLoadingParams } =
    useParameterContextsQuery(instanceId)

  const handleInstanceChange = useCallback((id: number | null) => {
    setInstanceId(id)
    setHasChecked(false)
  }, [])

  const handleReload = useCallback(() => {
    setHasChecked(true)
    refetch()
  }, [refetch])

  const handleDeploy = useCallback(
    async (path: string, flowId: number, paramContextId: string | null) => {
      if (!instanceId) return
      await onDeployRequest(instanceId, path, flowId, paramContextId)
      // Re-check paths after successful deploy
      refetch()
    },
    [instanceId, onDeployRequest, refetch],
  )

  return (
    <PathSection
      title={title}
      icon={icon}
      gradientClass={gradientClass}
      instances={instances}
      selectedInstanceId={instanceId}
      onInstanceChange={handleInstanceChange}
      pathStatuses={pathData?.status ?? []}
      isLoadingPaths={isLoadingPaths}
      hasChecked={hasChecked}
      registryFlows={registryFlows}
      isLoadingFlows={isLoadingFlows}
      paramContexts={paramContexts}
      isLoadingParams={isLoadingParams}
      deployingPaths={deployingPaths}
      onDeploy={handleDeploy}
      onReload={handleReload}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
    />
  )
}

// ============================================================================
// NifiInstallPage — top-level page component
// ============================================================================

export function NifiInstallPage() {
  const [deployingPaths, setDeployingPaths] = useState<Set<string>>(new Set())

  const { data: instancesData, isLoading: isLoadingInstances } = useNifiInstancesQuery()
  const instances = instancesData ?? EMPTY_INSTANCES

  const deployMutation = useDeployFlowMutation()

  const handleDeployRequest = useCallback(
    async (
      instanceId: number,
      path: string,
      flowId: number,
      paramContextId: string | null,
    ) => {
      setDeployingPaths((prev) => new Set([...prev, path]))
      try {
        await deployMutation.mutateAsync({
          instanceId,
          missingPath: path,
          flowId,
          parameterContextId: paramContextId,
          hierarchyAttribute: null,
        })
      } finally {
        setDeployingPaths((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
      }
    },
    [deployMutation],
  )

  if (isLoadingInstances) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <HardDriveDownload className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">NiFi Install</h1>
            <p className="text-muted-foreground mt-2">
              Check and create process groups for flow hierarchy paths
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <HardDriveDownload className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">NiFi Install</h1>
            <p className="text-muted-foreground mt-2">
              Check and create process groups for flow hierarchy paths
            </p>
          </div>
        </div>
      </div>

      {/* Info alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Note:</strong> Only configured flows are checked. You need at least one flow
          configured in the{' '}
          <a href="/flows/manage" className="underline font-medium">
            Flow Management
          </a>{' '}
          page to see the hierarchy paths here.
        </AlertDescription>
      </Alert>

      {/* Source Path Panel */}
      <SectionWrapper
        instances={instances}
        pathType="source"
        title="Source Path"
        icon={<Upload className="h-4 w-4" />}
        gradientClass="bg-gradient-to-r from-blue-400/80 to-blue-500/80"
        onDeployRequest={handleDeployRequest}
        deployingPaths={deployingPaths}
      />

      {/* Destination Path Panel */}
      <SectionWrapper
        instances={instances}
        pathType="destination"
        title="Destination Path"
        icon={<Download className="h-4 w-4" />}
        gradientClass="bg-gradient-to-r from-green-400/80 to-green-500/80"
        onDeployRequest={handleDeployRequest}
        deployingPaths={deployingPaths}
      />
    </div>
  )
}
