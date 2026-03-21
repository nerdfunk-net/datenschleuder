'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCw, Network, Filter } from 'lucide-react'
import { useMemo } from 'react'
import type { FlowStatus } from '../types'
import type { NifiCluster } from '@/components/features/settings/nifi/types'

const STATUS_FILTER_OPTIONS: { value: FlowStatus; label: string; color: string }[] = [
  { value: 'healthy', label: 'Green (Healthy)', color: 'bg-green-500' },
  { value: 'issues', label: 'Yellow (Problems)', color: 'bg-amber-500' },
  { value: 'unhealthy', label: 'Red (Not Deployed)', color: 'bg-red-500' },
  { value: 'unknown', label: 'Unknown', color: 'bg-gray-400' },
]

interface FlowMonitoringToolbarProps {
  flowCount: number
  searchFilter: string
  onSearchChange: (value: string) => void
  statusFilter: FlowStatus[]
  onToggleStatusFilter: (status: FlowStatus) => void
  clusterFilter: number | null
  onClusterFilterChange: (id: number | null) => void
  clusters: NifiCluster[]
  checking: boolean
  onOpenCheckDialog: () => void
}

export function FlowMonitoringToolbar({
  flowCount,
  searchFilter,
  onSearchChange,
  statusFilter,
  onToggleStatusFilter,
  clusterFilter,
  onClusterFilterChange,
  clusters,
  checking,
  onOpenCheckDialog,
}: FlowMonitoringToolbarProps) {
  const clusterOptions = useMemo(
    () => clusters.map((c) => ({ value: c.id, label: `${c.hierarchy_attribute}=${c.hierarchy_value}` })),
    [clusters],
  )

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Network className="h-4 w-4" />
          <span className="text-sm font-medium">Flow Monitoring</span>
        </div>
        <div className="text-xs text-blue-100">{flowCount} flows</div>
      </div>
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-xs">
            <Input
              placeholder="Filter by flow name..."
              value={searchFilter}
              onChange={(e) => onSearchChange(e.target.value)}
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
                  onCheckedChange={() => onToggleStatusFilter(opt.value)}
                />
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${opt.color}`} />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Cluster Filter */}
          <div className="min-w-[180px]">
            <Select
              value={clusterFilter !== null ? String(clusterFilter) : 'all'}
              onValueChange={(v) => onClusterFilterChange(v === 'all' ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Clusters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clusters</SelectItem>
                {clusterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Check All Button */}
          <Button disabled={checking} onClick={onOpenCheckDialog}>
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
  )
}
