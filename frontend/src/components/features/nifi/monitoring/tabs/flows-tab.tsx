'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Info,
  ExternalLink,
  Network,
  Filter,
} from 'lucide-react'
import { useNifiInstancesQuery, useMonitoringFlowsQuery } from '../hooks/use-monitoring-queries'
import { ProcessGroupDetailsDialog } from '../components/process-group-details-dialog'
import { CheckAllDialog } from '../components/check-all-dialog'
import { useApi } from '@/hooks/use-api'
import type {
  Flow,
  FlowType,
  FlowStatus,
  ProcessGroupStatus,
  DeploySettings,
  HierarchyConfig,
  AllPathsResponse,
  NifiInstance,
} from '../types'

// Stable defaults
const EMPTY_STATUS_FILTER: FlowStatus[] = []
const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_FLOWS: Flow[] = []

function getFlowItemKey(flowId: number, flowType: FlowType): string {
  return `${flowId}_${flowType}`
}

function determineFlowStatus(statusData: ProcessGroupStatus): FlowStatus {
  if (!statusData?.data) return 'unknown'
  const data = statusData.data
  if (data.not_deployed) return 'unhealthy'

  const bulletins = data.bulletins ?? []
  const stoppedCount = data.stopped_count ?? 0
  const disabledCount = data.disabled_count ?? 0
  const invalidCount = data.invalid_count ?? 0

  let queuedCount = 0
  const queuedCountValue = data.status?.aggregate_snapshot?.queued_count
  if (queuedCountValue !== undefined && queuedCountValue !== null) {
    queuedCount =
      typeof queuedCountValue === 'string' ? parseInt(queuedCountValue, 10) : queuedCountValue
  }

  if (
    bulletins.length === 0 &&
    stoppedCount === 0 &&
    disabledCount === 0 &&
    invalidCount === 0 &&
    queuedCount === 0
  ) {
    return 'healthy'
  }
  if (bulletins.length > 0 || stoppedCount > 0) return 'unhealthy'
  return 'warning'
}

function getFlowDisplayName(flow: Flow, flowType: FlowType): string {
  if (!flow) return 'Unnamed Flow'
  const flowName = flow.name ?? 'Unnamed'
  const prefix = flowType === 'source' ? 'src_' : 'dest_'
  const hierarchyParts: string[] = Object.keys(flow)
    .filter(
      (key) =>
        key.startsWith(prefix) &&
        key !== `${prefix}connection_param` &&
        key !== `${prefix}template_id`,
    )
    .sort()
    .map((key) => flow[key] as string)
    .filter(Boolean)

  if (hierarchyParts.length > 0) return `${flowName} / ${hierarchyParts.join('/')}`
  return flowName
}

function getStatusText(statusData: ProcessGroupStatus | undefined, status: FlowStatus): string {
  if (statusData?.data?.not_deployed) return 'Not Deployed'
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'unhealthy':
      return 'Issues Detected'
    case 'warning':
      return 'Warning'
    default:
      return 'Status Unknown'
  }
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function getProcessorCounts(statusData: ProcessGroupStatus | undefined): string {
  if (!statusData?.data) return 'N/A'
  const d = statusData.data
  return `${d.running_count ?? 0}/${d.stopped_count ?? 0}/${d.invalid_count ?? 0}/${d.disabled_count ?? 0}`
}

function getFlowFileStats(statusData: ProcessGroupStatus | undefined): string {
  const snapshot = statusData?.data?.status?.aggregate_snapshot
  if (!snapshot) return 'N/A'
  return `${snapshot.flow_files_in ?? 0}(${formatBytes(snapshot.bytes_in)})/${snapshot.flow_files_out ?? 0}(${formatBytes(snapshot.bytes_out)})/${snapshot.flow_files_sent ?? 0}(${formatBytes(snapshot.bytes_in)})`
}

function getQueueStats(statusData: ProcessGroupStatus | undefined): string {
  const snapshot = statusData?.data?.status?.aggregate_snapshot
  if (!snapshot) return 'N/A'
  return `${snapshot.queued ?? '0'}/${snapshot.queued_count ?? '0'}/${String(snapshot.bytes_queued ?? '0 bytes')}`
}

function getBulletinCount(statusData: ProcessGroupStatus | undefined): number {
  return statusData?.data?.bulletins?.length ?? 0
}

function getBulletinInfo(statusData: ProcessGroupStatus | undefined): string {
  const count = getBulletinCount(statusData)
  return count > 0 ? `${count} issue${count > 1 ? 's' : ''}` : 'None'
}

function getNiFiUrlFromStatus(
  statusData: ProcessGroupStatus | undefined,
  instances: { id: number; nifi_url: string }[],
): string | null {
  if (!statusData?.instance_id || !statusData?.process_group_id) return null
  const instance = instances.find((i) => i.id === statusData.instance_id)
  if (!instance) return null

  let nifiUrl = instance.nifi_url
  if (nifiUrl.includes('/nifi-api')) {
    nifiUrl = nifiUrl.replace('/nifi-api', '/nifi')
  } else if (nifiUrl.endsWith('/')) {
    nifiUrl = nifiUrl.slice(0, -1) + '/nifi'
  } else {
    nifiUrl = nifiUrl + '/nifi'
  }
  return `${nifiUrl}/#/process-groups/${statusData.process_group_id}`
}

const WIDGET_STATUS_CLASSES: Record<FlowStatus, string> = {
  healthy: 'bg-green-50 border border-green-200',
  unhealthy: 'bg-red-50 border border-red-200',
  warning: 'bg-amber-50 border border-amber-200',
  unknown: 'bg-gray-100 border border-gray-200',
}

const WIDGET_ICON: Record<FlowStatus, React.ReactNode> = {
  healthy: <CheckCircle2 className="h-4 w-4 text-green-700" />,
  unhealthy: <XCircle className="h-4 w-4 text-red-700" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-700" />,
  unknown: <HelpCircle className="h-4 w-4 text-gray-500" />,
}

interface FlowWidgetProps {
  flow: Flow
  flowType: FlowType
  statusData: ProcessGroupStatus | undefined
  highlighted: boolean
  instances: { id: number; nifi_url: string }[]
  onCardClick: () => void
  onInfoClick: () => void
  onStatusClick: () => void
}

function FlowWidget({
  flow,
  flowType,
  statusData,
  highlighted,
  instances,
  onCardClick,
  onInfoClick,
  onStatusClick,
}: FlowWidgetProps) {
  const status = statusData ? determineFlowStatus(statusData) : 'unknown'
  const statusText = getStatusText(statusData, status)
  const displayName = getFlowDisplayName(flow, flowType)
  const nifiUrl = getNiFiUrlFromStatus(statusData, instances)
  const hasStatusData = !!statusData

  return (
    <div
      className={`rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${WIDGET_STATUS_CLASSES[status]} ${
        highlighted ? 'ring-2 ring-blue-400 ring-offset-1 scale-[1.01] z-10' : ''
      }`}
      onClick={onCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2 pb-2 border-b border-black/10">
        <div className="flex-1 pr-2">
          <Badge
            className={`text-[10px] font-bold uppercase mb-1 ${
              flowType === 'source'
                ? 'bg-blue-500 text-white border-0'
                : 'bg-purple-500 text-white border-0'
            }`}
          >
            {flowType === 'source' ? 'Source' : 'Destination'}
          </Badge>
          <div
            className={`text-xs font-semibold text-slate-800 leading-tight ${
              nifiUrl ? 'text-blue-600 cursor-pointer underline decoration-dotted hover:decoration-solid' : ''
            }`}
            onClick={(e) => {
              if (nifiUrl) {
                e.stopPropagation()
                window.open(nifiUrl, '_blank')
              }
            }}
            title={nifiUrl ? 'Click to open in NiFi' : ''}
          >
            {displayName}
            {nifiUrl && <ExternalLink className="h-3 w-3 inline ml-1 opacity-60" />}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-1 rounded text-blue-500 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            disabled={!hasStatusData}
            title="View details"
            onClick={(e) => {
              e.stopPropagation()
              onInfoClick()
            }}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {WIDGET_ICON[status]}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">Flow ID:</span>
          <span className="font-semibold text-slate-700">#{flow.id}</span>
        </div>
        {hasStatusData && (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="running / stopped / invalid / disabled">
                Status:
              </span>
              <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">
                {getProcessorCounts(statusData)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="flow_files_in (bytes_in) / flow_files_out (bytes_out) / flow_files_sent (bytes_sent)">
                I/O:
              </span>
              <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">
                {getFlowFileStats(statusData)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="queued / queued_count / queued_size">
                Queue:
              </span>
              <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">
                {getQueueStats(statusData)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="Number of error bulletins">
                Bulletins:
              </span>
              <span className={`font-semibold text-right ${getBulletinCount(statusData) > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {getBulletinInfo(statusData)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="pt-1.5 border-t border-black/10 text-center">
        <button
          className="text-[10px] font-bold uppercase tracking-tight text-slate-600 hover:text-blue-600 hover:bg-black/5 px-2 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onStatusClick()
          }}
        >
          {statusText}
        </button>
      </div>
    </div>
  )
}

const STATUS_FILTER_OPTIONS: { value: FlowStatus; label: string; color: string }[] = [
  { value: 'healthy', label: 'Green (Healthy)', color: 'bg-green-500' },
  { value: 'warning', label: 'Yellow (Warning)', color: 'bg-amber-500' },
  { value: 'unhealthy', label: 'Red (Issues)', color: 'bg-red-500' },
  { value: 'unknown', label: 'Unknown', color: 'bg-gray-400' },
]

export function FlowsTab() {
  const { apiCall } = useApi()

  const [flowStatuses, setFlowStatuses] = useState<Record<string, ProcessGroupStatus>>({})
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [highlightedFlowId, setHighlightedFlowId] = useState<number | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<FlowStatus[]>(EMPTY_STATUS_FILTER)
  const [instanceFilter, setInstanceFilter] = useState<number | null>(null)
  const [showCheckAllDialog, setShowCheckAllDialog] = useState(false)
  const [showPGDetailsDialog, setShowPGDetailsDialog] = useState(false)
  const [selectedPGData, setSelectedPGData] = useState<ProcessGroupStatus | null>(null)
  const [selectedFlowType, setSelectedFlowType] = useState<FlowType | null>(null)

  const { data: instances = EMPTY_INSTANCES, isLoading: loadingInstances } = useNifiInstancesQuery()
  const { data: flows = EMPTY_FLOWS, isLoading: loadingFlows, error: flowsError } = useMonitoringFlowsQuery()

  const loading = loadingFlows || loadingInstances

  // Memoize instance filter options
  const instanceOptions = useMemo(
    () => instances.map((i) => ({ value: i.id, label: i.hierarchy_value })),
    [instances],
  )

  // Get status data for a specific flow/type
  const getFlowItemStatus = useCallback(
    (flow: Flow, flowType: FlowType): ProcessGroupStatus | undefined =>
      flowStatuses[getFlowItemKey(flow.id, flowType)],
    [flowStatuses],
  )

  // Filter flows
  const filteredFlows = useMemo(() => {
    let result = flows

    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase()
      result = result.filter((flow) => {
        if ((flow.name ?? '').toLowerCase().includes(search)) return true
        return Object.keys(flow).some((key) => {
          if (
            (key.startsWith('src_') || key.startsWith('dest_')) &&
            key !== 'src_connection_param' &&
            key !== 'dest_connection_param' &&
            key !== 'src_template_id' &&
            key !== 'dest_template_id'
          ) {
            return String(flow[key] ?? '').toLowerCase().includes(search)
          }
          return false
        })
      })
    }

    if (statusFilter.length > 0) {
      result = result.filter((flow) => {
        const srcStatus = getFlowItemStatus(flow, 'source')
        const destStatus = getFlowItemStatus(flow, 'destination')
        const srcFlowStatus = srcStatus ? determineFlowStatus(srcStatus) : 'unknown'
        const destFlowStatus = destStatus ? determineFlowStatus(destStatus) : 'unknown'
        return statusFilter.includes(srcFlowStatus) || statusFilter.includes(destFlowStatus)
      })
    }

    if (instanceFilter !== null) {
      result = result.filter((flow) => {
        const src = getFlowItemStatus(flow, 'source')
        const dest = getFlowItemStatus(flow, 'destination')
        return (
          (src && src.instance_id === instanceFilter) ||
          (dest && dest.instance_id === instanceFilter)
        )
      })
    }

    return result
  }, [flows, searchFilter, statusFilter, instanceFilter, getFlowItemStatus])

  // Summary counts
  const healthyCount = useMemo(
    () => Object.values(flowStatuses).filter((s) => determineFlowStatus(s) === 'healthy').length,
    [flowStatuses],
  )
  const unhealthyCount = useMemo(
    () => Object.values(flowStatuses).filter((s) => determineFlowStatus(s) === 'unhealthy').length,
    [flowStatuses],
  )
  const unknownCount = useMemo(
    () => flows.length * 2 - Object.keys(flowStatuses).length,
    [flows, flowStatuses],
  )

  const checkAllFlows = useCallback(
    async (instanceId: number) => {
      setChecking(true)
      setCheckError(null)
      setFlowStatuses({})

      try {
        const [settingsResponse, hierarchyResponse] = await Promise.all([
          apiCall<DeploySettings>('nifi/hierarchy/deploy'),
          apiCall<HierarchyConfig>('nifi/hierarchy/'),
        ])

        const allPathsResponse = await apiCall<AllPathsResponse>(
          `nifi/instances/${instanceId}/ops/process-groups/all-paths`,
        )

        console.log('🔍 [DEBUG] All paths response:', allPathsResponse)

        const pathToIdMap = new Map<string, string>()
        allPathsResponse.process_groups.forEach((pg) => {
          // backend returns path as "/Parent/Child" string; strip leading slash
          const pathString = pg.path.startsWith('/') ? pg.path.slice(1) : pg.path
          pathToIdMap.set(pathString, pg.id)
        })
        
        console.log('🗺️ [DEBUG] Path to ID map:', Object.fromEntries(pathToIdMap))

        const deploymentPaths = settingsResponse.paths
        const hierarchyConfig = hierarchyResponse.hierarchy.sort((a, b) => a.order - b.order)
        const instanceDeploymentPath = deploymentPaths[instanceId.toString()]

        console.log('⚙️ [DEBUG] Deployment paths:', deploymentPaths)
        console.log('📋 [DEBUG] Hierarchy config:', hierarchyConfig)
        console.log('🎯 [DEBUG] Instance deployment path:', instanceDeploymentPath)

        if (!instanceDeploymentPath) {
          setCheckError(`No deployment path configured for instance ${instanceId}`)
          return
        }

        const newStatuses: Record<string, ProcessGroupStatus> = {}

        const checkPart = async (flow: Flow, flowType: FlowType) => {
          const prefix = flowType === 'source' ? 'src_' : 'dest_'
          let basePath =
            flowType === 'source'
              ? instanceDeploymentPath.source_path.path
              : instanceDeploymentPath.dest_path.path
          
          console.log(`\n🔄 [DEBUG] Checking flow #${flow.id} (${flowType})`)
          console.log(`   Original basePath: "${basePath}"`)
          
          // Strip leading slash from basePath to match the pathToIdMap format
          if (basePath.startsWith('/')) {
            basePath = basePath.slice(1)
          }
          
          console.log(`   Stripped basePath: "${basePath}"`)
          
          const hierarchyParts: string[] = []

          for (let i = 1; i < hierarchyConfig.length; i++) {
            const attr = hierarchyConfig[i]
            if (!attr) continue
            const attrKey = `${prefix}${attr.name}`
            const attrValue = flow[attrKey]
            if (attrValue) hierarchyParts.push(attrValue as string)
          }

          console.log(`   Hierarchy parts:`, hierarchyParts)

          const expectedPath =
            hierarchyParts.length > 0
              ? `${basePath}/${hierarchyParts.join('/')}`
              : basePath

          console.log(`   Expected path: "${expectedPath}"`)

          const processGroupId = pathToIdMap.get(expectedPath)
          console.log(`   Found process group ID: ${processGroupId || 'NOT FOUND'}`)
          
          const flowKey = getFlowItemKey(flow.id, flowType)

          if (!processGroupId) {
            newStatuses[flowKey] = {
              status: 'not_deployed',
              instance_id: instanceId,
              process_group_id: '',
              detail: 'not_deployed',
              data: {
                not_deployed: true,
                message: 'Flow not found / Not deployed',
                expected_path: expectedPath,
              },
            }
            return
          }

          try {
            const response = await apiCall<ProcessGroupStatus>(
              `nifi/instances/${instanceId}/ops/process-groups/${processGroupId}/status`,
            )
            newStatuses[flowKey] = response
          } catch (err: unknown) {
            const errMsg = (err as Error).message ?? ''
            newStatuses[flowKey] = {
              status: 'not_deployed',
              instance_id: instanceId,
              process_group_id: '',
              detail: 'not_deployed',
              data: {
                not_deployed: true,
                message: errMsg.includes('404') ? 'Flow not found / Not deployed' : errMsg,
              },
            }
          }
        }

        // Check flows sequentially to avoid overwhelming the API
        for (const flow of flows) {
          await checkPart(flow, 'source')
          await checkPart(flow, 'destination')
        }

        console.log('\n✅ [DEBUG] Final flow statuses:', newStatuses)
        console.log(`📊 [DEBUG] Total statuses collected: ${Object.keys(newStatuses).length}`)

        setFlowStatuses(newStatuses)
      } catch (err: unknown) {
        setCheckError((err as Error).message || 'Failed to check flows')
      } finally {
        setChecking(false)
      }
    },
    [apiCall, flows],
  )

  const handleCardClick = useCallback((flow: Flow) => {
    setHighlightedFlowId((prev) => (prev === flow.id ? null : flow.id))
  }, [])

  const handleInfoClick = useCallback((flow: Flow, flowType: FlowType) => {
    const statusData = flowStatuses[getFlowItemKey(flow.id, flowType)]
    if (statusData) {
      setSelectedPGData(statusData)
      setSelectedFlowType(flowType)
      setShowPGDetailsDialog(true)
    }
  }, [flowStatuses])

  const handleStatusClick = useCallback((flow: Flow, flowType: FlowType) => {
    handleInfoClick(flow, flowType)
  }, [handleInfoClick])

  const toggleStatusFilter = useCallback((status: FlowStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    )
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (flowsError) {
    return (
      <Alert className="bg-red-50 border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          {(flowsError as Error).message || 'Failed to load flows'}
        </AlertDescription>
      </Alert>
    )
  }

  if (flows.length === 0) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          No flows found. Please create flows first.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Check error */}
      {checkError && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{checkError}</AlertDescription>
        </Alert>
      )}

      {/* Action Bar */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span className="text-sm font-medium">Flow Monitoring</span>
          </div>
          <div className="text-xs text-blue-100">{flows.length} flows</div>
        </div>
        <div className="p-4 bg-gradient-to-b from-white to-gray-50">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-xs">
              <Input
                placeholder="Filter by flow name..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value)
                  setHighlightedFlowId(null)
                }}
              />
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="h-4 w-4 text-gray-400" />
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-1.5 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={statusFilter.includes(opt.value)}
                    onCheckedChange={() => toggleStatusFilter(opt.value)}
                  />
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${opt.color}`} />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Instance Filter */}
            <div className="min-w-[160px]">
              <Select
                value={instanceFilter !== null ? String(instanceFilter) : 'all'}
                onValueChange={(v) => setInstanceFilter(v === 'all' ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Instances" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Instances</SelectItem>
                  {instanceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Check All Button */}
            <Button
              disabled={checking}
              onClick={() => setShowCheckAllDialog(true)}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {checking ? 'Checking...' : 'Check All'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Total Flows</p>
          <p className="text-2xl font-bold text-slate-900">{flows.length}</p>
        </div>
        <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Healthy</p>
          <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
        </div>
        <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Issues</p>
          <p className="text-2xl font-bold text-red-600">{unhealthyCount}</p>
        </div>
        <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Unknown</p>
          <p className="text-2xl font-bold text-gray-500">{unknownCount}</p>
        </div>
      </div>

      {/* Flow Widgets Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredFlows.map((flow) => (
          <React.Fragment key={flow.id}>
            <FlowWidget
              flow={flow}
              flowType="source"
              statusData={getFlowItemStatus(flow, 'source')}
              highlighted={highlightedFlowId === flow.id}
              instances={instances}
              onCardClick={() => handleCardClick(flow)}
              onInfoClick={() => handleInfoClick(flow, 'source')}
              onStatusClick={() => handleStatusClick(flow, 'source')}
            />
            <FlowWidget
              flow={flow}
              flowType="destination"
              statusData={getFlowItemStatus(flow, 'destination')}
              highlighted={highlightedFlowId === flow.id}
              instances={instances}
              onCardClick={() => handleCardClick(flow)}
              onInfoClick={() => handleInfoClick(flow, 'destination')}
              onStatusClick={() => handleStatusClick(flow, 'destination')}
            />
          </React.Fragment>
        ))}
      </div>

      {filteredFlows.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No flows match your filters</p>
          <p className="text-sm mt-1">Try adjusting the search or status filter</p>
        </div>
      )}

      {/* Dialogs */}
      <CheckAllDialog
        open={showCheckAllDialog}
        onOpenChange={setShowCheckAllDialog}
        instances={instances}
        loading={loadingInstances}
        onSelectInstance={checkAllFlows}
      />

      <ProcessGroupDetailsDialog
        open={showPGDetailsDialog}
        onOpenChange={setShowPGDetailsDialog}
        statusData={selectedPGData}
        flowType={selectedFlowType}
      />
    </div>
  )
}
