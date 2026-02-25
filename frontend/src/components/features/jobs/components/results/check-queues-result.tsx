"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckQueuesJobResult, CheckQueuesInstanceResult, CheckQueuesConnection } from "../../types/job-results"
import { CheckCircle2, XCircle, AlertTriangle, Activity, ChevronDown, ChevronRight } from "lucide-react"

interface CheckQueuesResultViewProps {
  result: CheckQueuesJobResult
}

function statusIcon(status: 'green' | 'yellow' | 'red') {
  switch (status) {
    case 'green':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'yellow':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    case 'red':
      return <XCircle className="h-4 w-4 text-red-600" />
  }
}

function statusBadgeClass(status: 'green' | 'yellow' | 'red') {
  switch (status) {
    case 'green':
      return 'bg-green-100 text-green-700 border-green-300'
    case 'yellow':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    case 'red':
      return 'bg-red-100 text-red-700 border-red-300'
  }
}

function connectionLabel(conn: CheckQueuesConnection): string {
  if (conn.name && conn.name.trim()) return conn.name
  const src = conn.source?.name || conn.source?.type || '?'
  const dst = conn.destination?.name || conn.destination?.type || '?'
  return `${src} → ${dst}`
}

function InstanceCard({ instance }: { instance: CheckQueuesInstanceResult }) {
  const [expanded, setExpanded] = useState(instance.overall_status !== 'green')
  const [showAll, setShowAll] = useState(false)

  const connections = instance.connections || []
  const problematic = connections.filter(c => c.queue_check?.status !== 'green')
  const displayed = showAll ? connections : problematic

  return (
    <Card className={instance.overall_status === 'red' ? 'border-red-300' : instance.overall_status === 'yellow' ? 'border-yellow-300' : ''}>
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            {statusIcon(instance.overall_status)}
            <CardTitle className="text-base">{instance.instance_name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {instance.error && (
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">Error</Badge>
            )}
            <Badge variant="outline" className={statusBadgeClass(instance.overall_status)}>
              {instance.overall_status.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">{instance.connection_count} connection(s)</span>
          </div>
        </div>
        {instance.error && (
          <CardDescription className="text-red-600 mt-1">{instance.error}</CardDescription>
        )}
      </CardHeader>

      {expanded && !instance.error && (
        <CardContent className="pt-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {showAll
                ? `All ${connections.length} connection(s)`
                : `${problematic.length} non-green connection(s) of ${connections.length}`}
            </span>
            {connections.length > 0 && (
              <Button
                size="sm"
                variant={showAll ? 'default' : 'outline'}
                onClick={e => { e.stopPropagation(); setShowAll(v => !v) }}
              >
                {showAll ? 'Show Issues Only' : 'Show All'}
              </Button>
            )}
          </div>

          {displayed.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="text-sm">All queues are within thresholds</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(conn => (
                <ConnectionRow key={conn.id} conn={conn} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function ConnectionRow({ conn }: { conn: CheckQueuesConnection }) {
  const qc = conn.queue_check
  const queued = conn.status?.aggregate_snapshot?.queued ?? '—'

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2 ${qc?.status === 'green' ? '' : qc?.status === 'yellow' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center gap-2 min-w-0">
        {statusIcon(qc?.status ?? 'green')}
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{connectionLabel(conn)}</p>
          <p className="text-xs text-muted-foreground truncate">
            {conn.source?.name || conn.source?.type} ({conn.source?.type}) → {conn.destination?.name || conn.destination?.type} ({conn.destination?.type})
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">Queued: {queued}</span>
        {qc?.count && (
          <Badge variant="outline" className={`text-xs ${statusBadgeClass(qc.count.status)}`}>
            {qc.count.queued_count} items
          </Badge>
        )}
        {qc?.bytes && (
          <Badge variant="outline" className={`text-xs ${statusBadgeClass(qc.bytes.status)}`}>
            {qc.bytes.queued_mb} MB
          </Badge>
        )}
      </div>
    </div>
  )
}

export function CheckQueuesResultView({ result }: CheckQueuesResultViewProps) {
  const instances = result.instances || []
  const { summary, thresholds, overall_status } = result

  return (
    <div className="space-y-4">
      {/* Overall Status + Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            NiFi Queue Check
            <Badge variant="outline" className={statusBadgeClass(overall_status)}>
              {overall_status.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>
            {result.message || `Checked ${instances.length} NiFi instance(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col items-center p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-700">{summary.green}</p>
              <p className="text-xs text-green-600">Green</p>
            </div>
            <div className="flex flex-col items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mb-1" />
              <p className="text-2xl font-bold text-yellow-700">{summary.yellow}</p>
              <p className="text-xs text-yellow-600">Yellow</p>
            </div>
            <div className="flex flex-col items-center p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600 mb-1" />
              <p className="text-2xl font-bold text-red-700">{summary.red}</p>
              <p className="text-xs text-red-600">Red</p>
            </div>
          </div>

          {/* Thresholds */}
          {thresholds && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Thresholds (mode: <span className="font-bold">{thresholds.mode}</span>)
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {(thresholds.mode === 'count' || thresholds.mode === 'both') && (
                  <>
                    <span>Count yellow: <strong>{thresholds.count_yellow.toLocaleString()}</strong></span>
                    <span>Count red: <strong>{thresholds.count_red.toLocaleString()}</strong></span>
                  </>
                )}
                {(thresholds.mode === 'bytes' || thresholds.mode === 'both') && (
                  <>
                    <span>Bytes yellow: <strong>{thresholds.bytes_yellow_mb} MB</strong></span>
                    <span>Bytes red: <strong>{thresholds.bytes_red_mb} MB</strong></span>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-instance results */}
      {instances.length > 0 && (
        <div className="space-y-3">
          {instances.map(inst => (
            <InstanceCard key={inst.instance_id} instance={inst} />
          ))}
        </div>
      )}
    </div>
  )
}
