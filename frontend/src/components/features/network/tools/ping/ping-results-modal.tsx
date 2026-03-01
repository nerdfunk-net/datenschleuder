'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  Download,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PingHost {
  ip: string
  alive: boolean
  response_time?: number
  hostname?: string
  packets_sent?: number
  packets_recv?: number
}

interface PingResult {
  hosts?: PingHost[]
  summary?: {
    total: number
    alive: number
    unreachable: number
    cidrs?: string[]
  }
  cidrs?: string[]
  error?: string
}

interface TaskStatus {
  task_id: string
  status: string
  result?: PingResult
  error?: string
  progress?: Record<string, unknown>
}

interface PingResultsModalProps {
  taskId: string
  onClose: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(['SUCCESS', 'FAILURE', 'REVOKED'])
const POLL_INTERVAL = 2000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTaskActive(status: string | undefined): boolean {
  if (!status) return true
  return !TERMINAL_STATES.has(status)
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'SUCCESS':
      return <Badge variant="default" className="bg-green-600">Complete</Badge>
    case 'FAILURE':
      return <Badge variant="destructive">Failed</Badge>
    case 'REVOKED':
      return <Badge variant="secondary">Cancelled</Badge>
    case 'PROGRESS':
      return <Badge variant="secondary">Running</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function exportCsv(hosts: PingHost[]) {
  const header = 'IP,Alive,Response Time (ms),Hostname,Packets Sent,Packets Received'
  const rows = hosts.map(h =>
    [
      h.ip,
      h.alive ? 'yes' : 'no',
      h.response_time != null ? h.response_time.toFixed(2) : '',
      h.hostname ?? '',
      h.packets_sent ?? '',
      h.packets_recv ?? '',
    ].join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ping-results.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PingResultsModal({ taskId, onClose }: PingResultsModalProps) {
  const { apiCall } = useApi()

  const { data: taskData, isError } = useQuery<TaskStatus>({
    queryKey: ['ping-task', taskId],
    queryFn: () => apiCall<TaskStatus>(`celery/tasks/${taskId}`, { method: 'GET' }),
    enabled: !!taskId,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return isTaskActive(status) ? POLL_INTERVAL : false
    },
  })

  const status = taskData?.status ?? 'PENDING'
  const result = taskData?.result
  const hosts = useMemo(() => result?.hosts ?? [], [result])
  const aliveHosts = useMemo(() => hosts.filter(h => h.alive), [hosts])
  const deadHosts = useMemo(() => hosts.filter(h => !h.alive), [hosts])

  const progressInfo = taskData?.progress as Record<string, unknown> | undefined
  const progressMessage = typeof progressInfo?.status === 'string' ? progressInfo.status : undefined

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Wifi className="h-5 w-5 text-blue-600" />
            Ping Results
            {getStatusBadge(status)}
          </DialogTitle>
        </DialogHeader>

        {/* Progress / loading state */}
        {isTaskActive(status) && (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm">{progressMessage ?? 'Task is running, please wait…'}</p>
            <p className="text-xs text-gray-400">Task ID: {taskId}</p>
          </div>
        )}

        {/* Error state */}
        {(status === 'FAILURE' || isError) && (
          <div className="flex flex-col items-center gap-2 py-8 text-red-600">
            <XCircle className="h-8 w-8" />
            <p className="text-sm font-medium">Task failed</p>
            {taskData?.error && (
              <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded w-full overflow-auto">
                {taskData.error}
              </pre>
            )}
          </div>
        )}

        {/* Results */}
        {status === 'SUCCESS' && result && (
          <div className="flex flex-col gap-4 min-h-0">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center border">
                <div className="text-2xl font-bold text-gray-900">{result.summary?.total ?? hosts.length}</div>
                <div className="text-xs text-gray-500 mt-1">Total Hosts</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                <div className="text-2xl font-bold text-green-700">{result.summary?.alive ?? aliveHosts.length}</div>
                <div className="text-xs text-green-600 mt-1">Reachable</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                <div className="text-2xl font-bold text-red-700">{result.summary?.unreachable ?? deadHosts.length}</div>
                <div className="text-xs text-red-600 mt-1">Unreachable</div>
              </div>
            </div>

            {/* Host list */}
            {hosts.length > 0 && (
              <div className="flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Host Details ({hosts.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCsv(hosts)}
                    className="gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Export CSV
                  </Button>
                </div>

                <ScrollArea className="flex-1 max-h-[420px] border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-2 pl-3 font-medium text-gray-600">Status</th>
                        <th className="text-left p-2 font-medium text-gray-600">IP Address</th>
                        <th className="text-left p-2 font-medium text-gray-600">Hostname</th>
                        <th className="text-right p-2 pr-3 font-medium text-gray-600">RTT (ms)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hosts.map((host) => (
                        <tr
                          key={host.ip}
                          className={host.alive ? 'bg-white hover:bg-green-50' : 'bg-white hover:bg-red-50 opacity-60'}
                        >
                          <td className="p-2 pl-3">
                            {host.alive ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                          </td>
                          <td className="p-2 font-mono text-gray-900">{host.ip}</td>
                          <td className="p-2 text-gray-600">{host.hostname ?? '—'}</td>
                          <td className="p-2 pr-3 text-right font-mono text-gray-700">
                            {host.response_time != null ? host.response_time.toFixed(1) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}

            {hosts.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No host data returned.
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t mt-auto">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
