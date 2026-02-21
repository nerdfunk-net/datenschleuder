'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Network } from 'lucide-react'
import type { ProcessGroupStatus, FlowType } from '../types'

interface ProcessGroupDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  statusData: ProcessGroupStatus | null
  flowType: FlowType | null
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

interface MetricCardProps {
  label: string
  value: string | number
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  className?: string
}

function StatCard({ label, value, className = '' }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
      <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${className}`}>{value}</p>
    </div>
  )
}

export function ProcessGroupDetailsDialog({
  open,
  onOpenChange,
  statusData,
  flowType,
}: ProcessGroupDetailsDialogProps) {
  if (!statusData) return null

  const data = statusData.data
  const snapshot = data?.status?.aggregate_snapshot
  const isNotDeployed = data?.not_deployed

  const title = data?.component?.name || 'Unknown'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-blue-600" />
            Process Group Status: {title}
            {flowType && (
              <Badge
                className={
                  flowType === 'source'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-purple-100 text-purple-800 border-purple-300'
                }
              >
                {flowType === 'source' ? 'Source' : 'Destination'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Not Deployed */}
          {isNotDeployed && (
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Flow Not Deployed</strong>
                <br />
                {data.message || 'This flow has not been deployed to the NiFi instance.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Processor Status */}
          {!isNotDeployed && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Processor Status
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Running" value={data?.running_count ?? 0} className="text-green-600" />
                <StatCard label="Stopped" value={data?.stopped_count ?? 0} className="text-red-600" />
                <StatCard label="Disabled" value={data?.disabled_count ?? 0} className="text-amber-600" />
                <StatCard label="Invalid" value={data?.invalid_count ?? 0} className="text-red-600" />
              </div>
            </div>
          )}

          {/* Ports */}
          {!isNotDeployed && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Ports
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Input Ports" value={data?.input_port_count ?? 0} />
                <MetricCard label="Output Ports" value={data?.output_port_count ?? 0} />
                <MetricCard label="Local Input" value={data?.local_input_port_count ?? 0} />
                <MetricCard label="Local Output" value={data?.local_output_port_count ?? 0} />
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {!isNotDeployed && snapshot && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Performance Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Active Threads" value={snapshot.active_thread_count ?? 0} />
                <MetricCard label="Queued FlowFiles" value={snapshot.flow_files_queued ?? 0} />
                <MetricCard label="Queued (5 min)" value={snapshot.queued ?? '0'} />
              </div>
            </div>
          )}

          {/* Throughput */}
          {!isNotDeployed && snapshot && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Throughput (5 min average)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Input" value={snapshot.input ?? '0'} />
                <MetricCard label="Output" value={snapshot.output ?? '0'} />
                <MetricCard label="Read" value={snapshot.read ?? '0'} />
                <MetricCard label="Written" value={snapshot.written ?? '0'} />
                <MetricCard label="Transferred" value={snapshot.transferred ?? '0'} />
                <MetricCard label="Received" value={snapshot.received ?? '0'} />
              </div>
            </div>
          )}

          {/* Data Volumes */}
          {!isNotDeployed && snapshot && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Data Volumes
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Bytes In" value={formatBytes(snapshot.bytes_in)} />
                <MetricCard label="Bytes Out" value={formatBytes(snapshot.bytes_out)} />
                <MetricCard label="Bytes Queued" value={formatBytes(snapshot.bytes_queued)} />
                <MetricCard label="Bytes Read" value={formatBytes(snapshot.bytes_read)} />
                <MetricCard label="Bytes Written" value={formatBytes(snapshot.bytes_written)} />
                <MetricCard label="Bytes Transferred" value={formatBytes(snapshot.bytes_transferred)} />
              </div>
            </div>
          )}

          {/* FlowFile Statistics */}
          {!isNotDeployed && snapshot && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                FlowFile Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="FlowFiles In" value={snapshot.flow_files_in ?? 0} />
                <MetricCard label="FlowFiles Out" value={snapshot.flow_files_out ?? 0} />
                <MetricCard label="FlowFiles Transferred" value={snapshot.flow_files_transferred ?? 0} />
                <MetricCard label="FlowFiles Received" value={snapshot.flow_files_received ?? 0} />
                <MetricCard label="FlowFiles Sent" value={snapshot.flow_files_sent ?? 0} />
              </div>
            </div>
          )}

          {/* Bulletins */}
          {!isNotDeployed && data?.bulletins && data.bulletins.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Bulletins ({data.bulletins.length})
              </h3>
              <div className="space-y-2">
                {data.bulletins.map((bulletin) => (
                  <Alert key={`${bulletin.bulletin?.source_name}-${bulletin.bulletin?.message}`} className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>{bulletin.bulletin?.source_name ?? 'Unknown'}:</strong>{' '}
                      {bulletin.bulletin?.message ?? 'No message'}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {!isNotDeployed && data?.bulletins && data.bulletins.length === 0 && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                No bulletins — all processors are running normally.
              </AlertDescription>
            </Alert>
          )}

          {/* Raw Response */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
              Raw Response
            </h3>
            <pre className="bg-slate-800 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
