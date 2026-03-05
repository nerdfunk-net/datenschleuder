'use client'

import { useMemo, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertCircle, Server, GitBranch, CheckCircle2, Activity } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNifiClusters, useNifiClusterProcessGroups } from '../hooks/use-template-queries'
import { EMPTY_NIFI_CLUSTERS, EMPTY_PROCESS_GROUPS } from '../utils/constants'
import type { NifiCluster } from '../types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExpectedStatus = 'Running' | 'Stopped' | 'Enabled' | 'Disabled'

const EXPECTED_STATUS_OPTIONS: { value: ExpectedStatus; label: string; color: string }[] = [
  { value: 'Running', label: 'Running', color: 'text-green-600' },
  { value: 'Stopped', label: 'Stopped', color: 'text-gray-500' },
  { value: 'Enabled', label: 'Enabled', color: 'text-blue-600' },
  { value: 'Disabled', label: 'Disabled', color: 'text-red-500' },
]

export interface CheckProgressGroupFieldsProps {
  /** ID of the selected NiFi cluster (null = none selected yet) */
  nifiClusterId: number | null
  onNifiClusterIdChange: (id: number | null) => void

  /** UUID of the selected process group */
  processGroupId: string | null
  /** Formatted path of the selected process group (kept for display / persisting) */
  processGroupPath: string | null
  onProcessGroupChange: (id: string | null, formattedPath: string | null) => void

  /** When true, also check all child process groups */
  checkChildren: boolean
  onCheckChildrenChange: (v: boolean) => void

  /** Expected operational status */
  expectedStatus: ExpectedStatus
  onExpectedStatusChange: (status: ExpectedStatus) => void
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getClusterLabel(cluster: NifiCluster): string {
  return `${cluster.cluster_id} (${cluster.hierarchy_attribute}: ${cluster.hierarchy_value})`
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CheckProgressGroupFields({
  nifiClusterId,
  onNifiClusterIdChange,
  processGroupId,
  processGroupPath,
  onProcessGroupChange,
  checkChildren,
  onCheckChildrenChange,
  expectedStatus,
  onExpectedStatusChange,
}: CheckProgressGroupFieldsProps) {
  // ── Clusters ───────────────────────────────────────────────────────────────
  const {
    data: clusters = EMPTY_NIFI_CLUSTERS,
    isLoading: clustersLoading,
    isError: clustersError,
  } = useNifiClusters()

  // ── Process groups – only fetched when a cluster is selected ───────────────
  const {
    data: processGroups = EMPTY_PROCESS_GROUPS,
    isLoading: processGroupsLoading,
    isError: processGroupsError,
  } = useNifiClusterProcessGroups({ clusterId: nifiClusterId })

  // Sorted by path for a tree-like visual order
  const sortedProcessGroups = useMemo(
    () => [...processGroups].sort((a, b) => a.path.localeCompare(b.path)),
    [processGroups]
  )

  const handleClusterChange = useCallback(
    (value: string) => {
      const id = Number(value)
      onNifiClusterIdChange(id)
      // Reset process group selection when cluster changes
      onProcessGroupChange(null, null)
    },
    [onNifiClusterIdChange, onProcessGroupChange]
  )

  const handleProcessGroupChange = useCallback(
    (value: string) => {
      const pg = processGroups.find((g) => g.id === value) ?? null
      onProcessGroupChange(pg?.id ?? null, pg?.formatted_path ?? null)
    },
    [processGroups, onProcessGroupChange]
  )

  // ── Derived values ─────────────────────────────────────────────────────────

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === nifiClusterId) ?? null,
    [clusters, nifiClusterId]
  )

  const selectedProcessGroup = useMemo(
    () => processGroups.find((pg) => pg.id === processGroupId) ?? null,
    [processGroups, processGroupId]
  )

  return (
    <div className="space-y-4">
      {/* ── NiFi Cluster (single selection) ────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">NiFi Cluster</span>
          </div>
          <div className="text-xs text-blue-100">Select exactly one NiFi cluster to target</div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {clustersLoading && (
            <div className="flex items-center gap-2 py-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading NiFi clusters…</span>
            </div>
          )}

          {clustersError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load NiFi clusters. Check your connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {!clustersLoading && !clustersError && clusters.length === 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No NiFi clusters are registered. Add clusters in the NiFi settings first.
              </AlertDescription>
            </Alert>
          )}

          {!clustersLoading && !clustersError && clusters.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Cluster</Label>
              <Select
                value={nifiClusterId !== null ? String(nifiClusterId) : ''}
                onValueChange={handleClusterChange}
              >
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue placeholder="Select a NiFi cluster…" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((cluster) => (
                    <SelectItem key={cluster.id} value={String(cluster.id)}>
                      <div className="flex items-center gap-2">
                        {nifiClusterId === cluster.id ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Server className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="font-medium">{cluster.cluster_id}</span>
                        <span className="text-xs text-gray-400 truncate">
                          {cluster.hierarchy_attribute}: {cluster.hierarchy_value}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCluster && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-blue-700">{getClusterLabel(selectedCluster)}</span>
                  {' · '}
                  {selectedCluster.members.length} instance{selectedCluster.members.length !== 1 ? 's' : ''}
                </p>
              )}

              {nifiClusterId === null && (
                <p className="text-xs text-amber-600">
                  Select a cluster to load the available process groups.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Process Group selection ────────────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-4 w-4" />
            <span className="text-sm font-medium">Process Group</span>
          </div>
          <div className="text-xs text-blue-100">Choose the process group to check</div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* Not yet selected a cluster */}
          {nifiClusterId === null && (
            <p className="text-sm text-gray-400 italic">
              Select a NiFi cluster above to load process groups.
            </p>
          )}

          {/* Loading process groups */}
          {nifiClusterId !== null && processGroupsLoading && (
            <div className="flex items-center gap-2 py-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading process groups…</span>
            </div>
          )}

          {/* Error loading process groups */}
          {nifiClusterId !== null && processGroupsError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load process groups. Check the NiFi connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* No process groups returned */}
          {nifiClusterId !== null && !processGroupsLoading && !processGroupsError && processGroups.length === 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No process groups found for this cluster.
              </AlertDescription>
            </Alert>
          )}

          {/* Process group selector */}
          {nifiClusterId !== null && !processGroupsLoading && !processGroupsError && processGroups.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Process Group</Label>
              <Select
                value={processGroupId ?? ''}
                onValueChange={handleProcessGroupChange}
              >
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue placeholder="Select a process group…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {sortedProcessGroups.map((pg) => (
                    <SelectItem key={pg.id} value={pg.id}>
                      <div className="flex items-center gap-2 py-0.5">
                        {/* Indentation by level */}
                        {pg.level > 0 && (
                          <span
                            className="flex-shrink-0 text-gray-300 select-none"
                            style={{ paddingLeft: `${(pg.level - 1) * 12}px` }}
                          >
                            └
                          </span>
                        )}
                        <span className={pg.level === 0 ? 'font-semibold' : 'font-normal'}>
                          {pg.formatted_path}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProcessGroup && (
                <p className="text-xs text-gray-500 break-all">
                  <span className="font-medium text-blue-700">Path:</span>{' '}
                  {selectedProcessGroup.path}
                </p>
              )}

              {!processGroupId && (
                <p className="text-xs text-amber-600">
                  No process group selected — the job cannot run without a target.
                </p>
              )}
            </div>
          )}

          {/* Show stored path when editing and process groups aren't loaded yet */}
          {processGroupId && processGroupPath && !selectedProcessGroup && !processGroupsLoading && (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Currently selected:</span>{' '}
                {processGroupPath}
              </p>
            </div>
          )}

          {/* ── Check all Children ─────────────────────────────────────────── */}
          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                id="check-children"
                checked={checkChildren}
                onCheckedChange={(v) => onCheckChildrenChange(!!v)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors">
                  Check all Children
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  When enabled, all child process groups of the selected group are also checked
                  against the expected status.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ── Expected Status ────────────────────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">Expected Status</span>
          </div>
          <div className="text-xs text-blue-100">
            The status the process group is expected to be in
          </div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Status</Label>
            <div className="flex gap-2 flex-wrap">
              {EXPECTED_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onExpectedStatusChange(opt.value)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    expectedStatus === opt.value
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                      opt.value === 'Running'
                        ? 'bg-green-500'
                        : opt.value === 'Stopped'
                          ? 'bg-gray-400'
                          : opt.value === 'Enabled'
                            ? 'bg-blue-500'
                            : 'bg-red-400'
                    }`}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              The job will report a problem if the actual status does not match the expected status.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
