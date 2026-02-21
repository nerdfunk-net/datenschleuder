'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Server,
} from 'lucide-react'
import { useNifiInstancesQuery } from '../hooks/use-monitoring-queries'
import { queryKeys } from '@/lib/query-keys'
import { useApi } from '@/hooks/use-api'
import type { NifiInstance, Connection } from '../types'

const EMPTY_INSTANCES: NifiInstance[] = []

type SortField = 'flowFilesIn' | 'flowFilesOut' | null
type SortDirection = 'asc' | 'desc'

function hasQueue(connection: Connection): boolean {
  const queued = connection.status?.aggregate_snapshot?.queued ?? '0'
  const match = queued.match(/^(\d+)/)
  return match ? parseInt(match[1] ?? '0', 10) > 0 : false
}

function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/([\d.]+)\s*(bytes|KB|MB|GB|TB)?/i)
  if (!match) return 0
  const value = parseFloat(match[1] ?? '0')
  const unit = (match[2] ?? 'bytes').toUpperCase()
  const multipliers: Record<string, number> = {
    BYTES: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  }
  return value * (multipliers[unit] ?? 1)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 bytes'
  const k = 1024
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function getTypeBadgeClass(type: string | undefined): string {
  switch (type) {
    case 'PROCESSOR':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'INPUT_PORT':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'OUTPUT_PORT':
      return 'bg-sky-100 text-sky-800 border-sky-200'
    case 'FUNNEL':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function formatType(type: string | undefined): string {
  if (!type) return 'N/A'
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getNiFiUrl(connection: Connection, instance: NifiInstance | undefined): string | undefined {
  if (!instance || !connection.parent_group_id) return undefined
  let nifiUrl = instance.nifi_url
  if (nifiUrl.includes('/nifi-api')) {
    nifiUrl = nifiUrl.replace('/nifi-api', '/nifi')
  } else if (nifiUrl.endsWith('/')) {
    nifiUrl = nifiUrl.slice(0, -1) + '/nifi'
  } else {
    nifiUrl = nifiUrl + '/nifi'
  }
  return `${nifiUrl}/#/process-groups/${connection.parent_group_id}`
}

function StatCard({ label, value, className = '' }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold text-slate-900 ${className}`}>{value}</p>
    </div>
  )
}

export function QueuesTab() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [checking, setChecking] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data: instances = EMPTY_INSTANCES, isLoading: loadingInstances } = useNifiInstancesQuery()

  const selectedInstance = useMemo(
    () => instances.find((i) => i.id === selectedInstanceId),
    [instances, selectedInstanceId],
  )

  const handleInstanceChange = useCallback((value: string) => {
    setSelectedInstanceId(value === 'null' ? null : Number(value))
    setConnections([])
    setHasChecked(false)
    setError(null)
  }, [])

  const checkAllQueues = useCallback(async () => {
    if (!selectedInstanceId) return
    setChecking(true)
    setError(null)
    setHasChecked(false)

    try {
      const result = await apiCall<{
        status: string
        components: Connection[]
        count: number
      }>(`nifi/instances/${selectedInstanceId}/ops/components?kind=connections`)
      setConnections(result?.components ?? [])
      setHasChecked(true)
      // Invalidate queue cache
      queryClient.invalidateQueries({ queryKey: queryKeys.nifi.queues(selectedInstanceId) })
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to check queues')
      setConnections([])
    } finally {
      setChecking(false)
    }
  }, [selectedInstanceId, apiCall, queryClient])

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField])

  const sortedConnections = useMemo(() => {
    const sorted = [...connections]

    if (sortField) {
      sorted.sort((a, b) => {
        let aValue = 0
        let bValue = 0
        if (sortField === 'flowFilesIn') {
          aValue = a.status?.aggregate_snapshot?.flow_files_in ?? 0
          bValue = b.status?.aggregate_snapshot?.flow_files_in ?? 0
        } else if (sortField === 'flowFilesOut') {
          aValue = a.status?.aggregate_snapshot?.flow_files_out ?? 0
          bValue = b.status?.aggregate_snapshot?.flow_files_out ?? 0
        }
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      })
    } else {
      sorted.sort((a, b) => {
        const aQueued = hasQueue(a)
        const bQueued = hasQueue(b)
        if (aQueued && !bQueued) return -1
        if (!aQueued && bQueued) return 1
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
    }

    return sorted
  }, [connections, sortField, sortDirection])

  const queuedCount = useMemo(() => connections.filter(hasQueue).length, [connections])

  const totalFlowFiles = useMemo(() =>
    connections.reduce((sum, conn) => {
      const queued = conn.status?.aggregate_snapshot?.queued ?? '0'
      const match = queued.match(/^(\d+)/)
      return sum + (match ? parseInt(match[1] ?? '0', 10) : 0)
    }, 0),
    [connections],
  )

  const totalQueuedSize = useMemo(() => {
    let totalBytes = 0
    connections.forEach((conn) => {
      const queued = conn.status?.aggregate_snapshot?.queued ?? '0'
      const match = queued.match(/\(([^)]+)\)/)
      if (match && match[1]) {
        totalBytes += parseSizeToBytes(match[1].trim())
      }
    })
    return formatBytes(totalBytes)
  }, [connections])

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    if (sortDirection === 'asc') return <ArrowUp className="h-3 w-3 ml-1" />
    return <ArrowDown className="h-3 w-3 ml-1" />
  }

  return (
    <div className="space-y-6">
      {/* Instance Selection + Action */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">Select NiFi Instance</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 max-w-md space-y-2">
              <Label>NiFi Instance</Label>
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
                      {inst.hierarchy_value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!selectedInstanceId || checking}
              onClick={checkAllQueues}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {checking ? 'Checking...' : 'Check All Queues'}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading instances */}
      {loadingInstances && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading instances...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* No instance selected */}
      {!selectedInstanceId && !loadingInstances && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Please select a NiFi instance to view queues.
          </AlertDescription>
        </Alert>
      )}

      {/* Empty after check */}
      {!checking && !error && connections.length === 0 && selectedInstanceId && hasChecked && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            No connections found for this instance.
          </AlertDescription>
        </Alert>
      )}

      {/* Queues Table */}
      {connections.length > 0 && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">Connection Queues</span>
            </div>
            <div className="text-xs text-blue-100">{connections.length} total</div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Connections" value={connections.length} />
              <StatCard label="Queued Connections" value={queuedCount} className="text-amber-600" />
              <StatCard label="Total FlowFiles" value={totalFlowFiles} className="text-blue-600" />
              <StatCard label="Total Size" value={totalQueuedSize} className="text-green-600" />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 hover:from-blue-400/80 hover:to-blue-500/80">
                    <TableHead className="text-white font-semibold">Connection Name</TableHead>
                    <TableHead className="text-white font-semibold">Source</TableHead>
                    <TableHead className="text-white font-semibold">Source Type</TableHead>
                    <TableHead className="text-white font-semibold">Destination</TableHead>
                    <TableHead className="text-white font-semibold">Destination Type</TableHead>
                    <TableHead className="text-white font-semibold text-right">Queued</TableHead>
                    <TableHead
                      className="text-white font-semibold text-right cursor-pointer select-none hover:bg-white/10"
                      onClick={() => toggleSort('flowFilesIn')}
                    >
                      <div className="flex items-center justify-end">
                        FlowFiles In
                        <SortIcon field="flowFilesIn" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-white font-semibold text-right cursor-pointer select-none hover:bg-white/10"
                      onClick={() => toggleSort('flowFilesOut')}
                    >
                      <div className="flex items-center justify-end">
                        FlowFiles Out
                        <SortIcon field="flowFilesOut" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedConnections.map((connection) => {
                    const url = getNiFiUrl(connection, selectedInstance)
                    const queued = hasQueue(connection)
                    return (
                      <TableRow
                        key={connection.id}
                        className={queued ? 'bg-amber-50 hover:bg-amber-100' : ''}
                      >
                        <TableCell>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline decoration-dotted hover:decoration-solid"
                            >
                              {connection.name ? (
                                <span className="font-semibold">{connection.name}</span>
                              ) : (
                                <span className="italic text-muted-foreground">Unnamed</span>
                              )}
                            </a>
                          ) : (
                            <>
                              {connection.name ? (
                                <span className="font-semibold">{connection.name}</span>
                              ) : (
                                <span className="italic text-muted-foreground">Unnamed</span>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell>{connection.source?.name ?? 'N/A'}</TableCell>
                        <TableCell>
                          <Badge className={getTypeBadgeClass(connection.source?.type)}>
                            {formatType(connection.source?.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{connection.destination?.name ?? 'N/A'}</TableCell>
                        <TableCell>
                          <Badge className={getTypeBadgeClass(connection.destination?.type)}>
                            {formatType(connection.destination?.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {queued ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                              {connection.status?.aggregate_snapshot?.queued ?? '0'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {connection.status?.aggregate_snapshot?.queued ?? '0'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {connection.status?.aggregate_snapshot?.flow_files_in ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {connection.status?.aggregate_snapshot?.flow_files_out ?? 0}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
