'use client'

import { useState, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, Info } from 'lucide-react'
import { useNifiInstancesQuery, useSystemDiagnosticsQuery } from '../hooks/use-monitoring-queries'
import { DetailedDiagnosticsDialog } from '../components/detailed-diagnostics-dialog'
import type { SystemSnapshot, NifiInstance } from '../types'

const EMPTY_INSTANCES: NifiInstance[] = []

function SummaryCard({ label, value, sub, children }: {
  label: string
  value: string
  sub?: string
  children?: React.ReactNode
}) {
  return (
    <div className="shadow-lg border-0 bg-white rounded-lg p-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 my-1">{value}</p>
      {children}
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className="text-sm font-semibold text-slate-900 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function getMemoryPercent(utilization: string | undefined): number {
  if (!utilization) return 0
  return parseFloat(utilization) || 0
}

function getProgressColor(utilization: string | undefined): string {
  const pct = getMemoryPercent(utilization)
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 75) return 'bg-amber-500'
  return 'bg-green-500'
}

export function InstancesTab() {
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null)
  const [showDetailedModal, setShowDetailedModal] = useState(false)

  const { data: instances = EMPTY_INSTANCES, isLoading: loadingInstances, error: instancesError } = useNifiInstancesQuery()
  const { data: diagnosticsResponse, isLoading: loadingDiagnostics, error: diagnosticsError } =
    useSystemDiagnosticsQuery(selectedInstanceId)

  const snapshot: SystemSnapshot | null = useMemo(
    () => diagnosticsResponse?.data?.system_diagnostics?.aggregate_snapshot ?? null,
    [diagnosticsResponse],
  )

  const cpuLoad = useMemo(() => {
    const load = snapshot?.processor_load_average
    return load !== undefined && load !== null ? load.toFixed(2) : 'N/A'
  }, [snapshot])

  const javaVersion = useMemo(() => {
    const info = snapshot?.version_info
    if (info?.java_version && info?.java_vendor) {
      return `${info.java_version} (${info.java_vendor})`
    }
    return 'N/A'
  }, [snapshot])

  const osInfo = useMemo(() => {
    const info = snapshot?.version_info
    if (info?.os_name && info?.os_version) {
      return `${info.os_name} ${info.os_version} (${info.os_architecture ?? 'N/A'})`
    }
    return 'N/A'
  }, [snapshot])

  const contentRepo = useMemo(() => {
    const repos = snapshot?.content_repository_storage_usage
    return repos && repos.length > 0 ? repos[0] : null
  }, [snapshot])

  const handleInstanceChange = (value: string) => {
    setSelectedInstanceId(value === 'null' ? null : Number(value))
  }

  const error = instancesError || diagnosticsError
  const loading = loadingInstances || (selectedInstanceId !== null && loadingDiagnostics)

  return (
    <div className="space-y-6">
      {/* Instance Selector */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Instance Selection</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="max-w-md space-y-2">
            <Label>Select NiFi Instance</Label>
            <Select
              value={selectedInstanceId !== null ? String(selectedInstanceId) : 'null'}
              onValueChange={handleInstanceChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Select an instance --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">-- Select an instance --</SelectItem>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={String(inst.id)}>
                    {inst.hierarchy_value} ({inst.nifi_url})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {(error as Error).message || 'Failed to load data'}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Monitoring Data */}
      {selectedInstanceId !== null && !loading && !error && snapshot && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Heap Memory"
              value={snapshot.heap_utilization ?? 'N/A'}
              sub={`${snapshot.used_heap ?? 'N/A'} / ${snapshot.max_heap ?? 'N/A'}`}
            >
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 mt-2">
                <div
                  className={`h-full transition-all duration-300 ease-in-out ${getProgressColor(snapshot.heap_utilization)}`}
                  style={{ width: `${Math.max(0, Math.min(100, getMemoryPercent(snapshot.heap_utilization)))}%` }}
                />
              </div>
            </SummaryCard>

            <SummaryCard
              label="CPU Load"
              value={cpuLoad}
              sub={`${snapshot.available_processors ?? 'N/A'} processors`}
            />

            <SummaryCard
              label="Threads"
              value={String(snapshot.total_threads ?? 'N/A')}
              sub={`${snapshot.daemon_threads ?? 'N/A'} daemon`}
            />

            <SummaryCard
              label="Content Storage"
              value={contentRepo?.utilization ?? 'N/A'}
              sub={`${contentRepo?.used_space ?? 'N/A'} / ${contentRepo?.total_space ?? 'N/A'}`}
            />
          </div>

          {/* Version and System Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4" />
                  <span className="text-sm font-medium">Version Information</span>
                </div>
              </div>
              <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-1">
                <InfoRow label="NiFi Version" value={snapshot.version_info?.ni_fi_version ?? 'N/A'} />
                <InfoRow label="Build Tag" value={snapshot.version_info?.build_tag ?? 'N/A'} />
                <InfoRow label="Java Version" value={javaVersion} />
                <InfoRow label="OS" value={osInfo} />
              </div>
            </div>

            <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4" />
                  <span className="text-sm font-medium">System Status</span>
                </div>
              </div>
              <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-1">
                <InfoRow label="Uptime" value={snapshot.uptime ?? 'N/A'} />
                <InfoRow label="Last Refreshed" value={snapshot.stats_last_refreshed ?? 'N/A'} />
              </div>
            </div>
          </div>

          {/* Show Detailed Info */}
          <div className="flex justify-center">
            <Button onClick={() => setShowDetailedModal(true)}>
              <Info className="h-4 w-4 mr-2" />
              Show Detailed Info
            </Button>
          </div>
        </>
      )}

      {/* No instance selected */}
      {!selectedInstanceId && !loading && !error && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Select a NiFi instance above to view system diagnostics.
          </AlertDescription>
        </Alert>
      )}

      <DetailedDiagnosticsDialog
        open={showDetailedModal}
        onOpenChange={setShowDetailedModal}
        snapshot={snapshot}
      />
    </div>
  )
}
