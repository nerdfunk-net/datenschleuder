'use client'

import { useState, useMemo, useCallback } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useNifiInstancesQuery, useMonitoringFlowsQuery } from '../hooks/use-monitoring-queries'
import { useNifiClustersQuery } from '@/components/features/settings/nifi/hooks/use-nifi-clusters-query'
import { ProcessGroupDetailsDialog } from '../components/process-group-details-dialog'
import { CheckAllDialog } from '../components/check-all-dialog'
import { FlowMonitoringToolbar } from '../components/flow-monitoring-toolbar'
import { FlowSummaryCards } from '../components/flow-summary-cards'
import { FlowGrid } from '../components/flow-grid'
import { useFlowMonitoringFilters } from '../hooks/use-flow-monitoring-filters'
import { useFlowStatusCheck } from '../hooks/use-flow-status-check'
import { getFlowItemKey, determineFlowStatus } from '../utils/flow-status-utils'
import type {
  Flow,
  FlowType,
  ProcessGroupStatus,
  NifiInstance,
} from '../types'
import type { NifiCluster } from '@/components/features/settings/nifi/types'

const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_CLUSTERS: NifiCluster[] = []
const EMPTY_FLOWS: Flow[] = []

export function FlowsTab() {
  const [highlightedFlowId, setHighlightedFlowId] = useState<number | null>(null)
  const [showCheckAllDialog, setShowCheckAllDialog] = useState(false)
  const [showPGDetailsDialog, setShowPGDetailsDialog] = useState(false)
  const [selectedPGData, setSelectedPGData] = useState<ProcessGroupStatus | null>(null)
  const [selectedFlowType, setSelectedFlowType] = useState<FlowType | null>(null)

  const { data: instances = EMPTY_INSTANCES, isLoading: loadingInstances } = useNifiInstancesQuery()
  const { data: clusters = EMPTY_CLUSTERS, isLoading: loadingClusters } = useNifiClustersQuery()
  const { data: flows = EMPTY_FLOWS, isLoading: loadingFlows, error: flowsError } = useMonitoringFlowsQuery()

  const loading = loadingFlows || loadingInstances || loadingClusters

  const {
    searchFilter,
    setSearchFilter,
    statusFilter,
    toggleStatusFilter,
    clusterFilter,
    setClusterFilter,
  } = useFlowMonitoringFilters()

  const {
    flowStatuses,
    checking,
    checkError,
    checkAllFlows,
    getFlowItemStatus,
    healthyCount,
    unhealthyCount,
    unknownCount,
  } = useFlowStatusCheck(flows)

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

    if (clusterFilter !== null) {
      const matchingCluster = clusters.find((c) => c.id === clusterFilter)
      const memberInstanceIds = matchingCluster
        ? new Set(matchingCluster.members.map((m) => m.instance_id))
        : new Set<number>()
      result = result.filter((flow) => {
        const src = getFlowItemStatus(flow, 'source')
        const dest = getFlowItemStatus(flow, 'destination')
        return (
          (src && memberInstanceIds.has(src.instance_id)) ||
          (dest && memberInstanceIds.has(dest.instance_id))
        )
      })
    }

    return result
  }, [flows, searchFilter, statusFilter, clusterFilter, clusters, getFlowItemStatus])

  const handleCardClick = useCallback((flow: Flow) => {
    setHighlightedFlowId((prev) => (prev === flow.id ? null : flow.id))
  }, [])

  const handleInfoClick = useCallback(
    (flow: Flow, flowType: FlowType) => {
      const statusData = flowStatuses[getFlowItemKey(flow.id, flowType)]
      if (statusData) {
        setSelectedPGData(statusData)
        setSelectedFlowType(flowType)
        setShowPGDetailsDialog(true)
      }
    },
    [flowStatuses],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchFilter(value)
      setHighlightedFlowId(null)
    },
    [setSearchFilter],
  )

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
      {checkError && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{checkError}</AlertDescription>
        </Alert>
      )}

      <FlowMonitoringToolbar
        flowCount={flows.length}
        searchFilter={searchFilter}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onToggleStatusFilter={toggleStatusFilter}
        clusterFilter={clusterFilter}
        onClusterFilterChange={setClusterFilter}
        clusters={clusters}
        checking={checking}
        onOpenCheckDialog={() => setShowCheckAllDialog(true)}
      />

      <FlowSummaryCards
        totalFlows={flows.length}
        healthyCount={healthyCount}
        unhealthyCount={unhealthyCount}
        unknownCount={unknownCount}
      />

      <FlowGrid
        flows={filteredFlows}
        getFlowItemStatus={getFlowItemStatus}
        highlightedFlowId={highlightedFlowId}
        instances={instances}
        onCardClick={handleCardClick}
        onInfoClick={handleInfoClick}
        onStatusClick={handleInfoClick}
      />

      <CheckAllDialog
        open={showCheckAllDialog}
        onOpenChange={setShowCheckAllDialog}
        clusters={clusters}
        loading={loadingClusters}
        onSelectCluster={checkAllFlows}
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
