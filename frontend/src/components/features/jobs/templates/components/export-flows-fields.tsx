'use client'

import { useMemo, useCallback, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, Server, CheckCircle2, Filter, GitBranch, FileText, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNifiClusters, useHierarchyAttributeValues, useFilteredFlows, useExportRepos } from '../hooks/use-template-queries'
import { EMPTY_NIFI_CLUSTERS, EMPTY_EXPORT_REPOS } from '../utils/constants'
import type { NifiCluster, ExportFlowsFilters } from '../types'

// Stable empty constant – prevents re-render loops
const EMPTY_IDS: number[] = []

function getClusterLabel(cluster: NifiCluster): string {
  return `${cluster.cluster_id} (${cluster.hierarchy_attribute}: ${cluster.hierarchy_value})`
}

interface ExportFlowsFieldsProps {
  // Cluster selection: null = all clusters, array = specific cluster IDs (informational)
  nifiClusterIds: number[] | null
  onNifiClusterIdsChange: (ids: number[] | null) => void
  // Flow scope
  allFlows: boolean
  onAllFlowsChange: (v: boolean) => void
  // Filters (used when allFlows = false)
  filters: ExportFlowsFilters
  onFiltersChange: (f: ExportFlowsFilters) => void
  // Export destination
  gitRepoId: number | null
  onGitRepoIdChange: (id: number | null) => void
  filename: string
  onFilenameChange: (v: string) => void
  exportType: 'json' | 'csv'
  onExportTypeChange: (v: 'json' | 'csv') => void
  pushToGit: boolean
  onPushToGitChange: (v: boolean) => void
}

export function ExportFlowsFields({
  nifiClusterIds,
  onNifiClusterIdsChange,
  allFlows,
  onAllFlowsChange,
  filters,
  onFiltersChange,
  gitRepoId,
  onGitRepoIdChange,
  filename,
  onFilenameChange,
  exportType,
  onExportTypeChange,
  pushToGit,
  onPushToGitChange,
}: ExportFlowsFieldsProps) {
  const { data: clusters = EMPTY_NIFI_CLUSTERS, isLoading: clustersLoading, isError: clustersError } = useNifiClusters()
  const { data: exportRepos = EMPTY_EXPORT_REPOS, isLoading: reposLoading } = useExportRepos()
  const { data: hierarchyAttrValues, isLoading: hierLoading } = useHierarchyAttributeValues()
  const filterMutation = useFilteredFlows()

  const [filterMatchCount, setFilterMatchCount] = useState<number | null>(null)

  const isAllClusters = nifiClusterIds === null
  const selectedIds = nifiClusterIds ?? EMPTY_IDS

  const handleAllToggle = useCallback(() => {
    onNifiClusterIdsChange(null)
  }, [onNifiClusterIdsChange])

  const handleSpecificToggle = useCallback(() => {
    onNifiClusterIdsChange([])
  }, [onNifiClusterIdsChange])

  const handleClusterToggle = useCallback(
    (clusterId: number, checked: boolean) => {
      if (checked) {
        onNifiClusterIdsChange([...selectedIds, clusterId])
      } else {
        onNifiClusterIdsChange(selectedIds.filter((id) => id !== clusterId))
      }
    },
    [selectedIds, onNifiClusterIdsChange]
  )

  const selectedClusters = useMemo(
    () => clusters.filter((c) => selectedIds.includes(c.id)),
    [clusters, selectedIds]
  )

  const handleFilterSideToggle = useCallback(
    (attrName: string, side: 'source' | 'destination', value: string, checked: boolean) => {
      const current = filters[attrName] ?? { source: [], destination: [] }
      const currentSide = current[side] ?? []
      const newSide = checked
        ? [...currentSide, value]
        : currentSide.filter((v) => v !== value)
      onFiltersChange({
        ...filters,
        [attrName]: { ...current, [side]: newSide },
      })
      // Reset match count when filters change
      setFilterMatchCount(null)
    },
    [filters, onFiltersChange]
  )

  const handleCheckFilter = useCallback(() => {
    filterMutation.mutate(filters, {
      onSuccess: (data) => {
        setFilterMatchCount(data.count)
      },
    })
  }, [filterMutation, filters])

  const hierarchyEntries = useMemo(
    () => Object.entries(hierarchyAttrValues ?? {}),
    [hierarchyAttrValues]
  )

  const selectedRepo = useMemo(
    () => exportRepos.find((r) => r.id === gitRepoId) ?? null,
    [exportRepos, gitRepoId]
  )

  return (
    <div className="space-y-4">
      {/* ── NiFi Cluster (informational) ──────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-teal-400/80 to-teal-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">NiFi Cluster</span>
          </div>
          <div className="text-xs text-teal-100">Informational — flows come from the local database</div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Target Clusters</Label>
            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isAllClusters ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <Checkbox
                  checked={isAllClusters}
                  onCheckedChange={(checked) => { if (checked) handleAllToggle() }}
                  className="rounded-full"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">All clusters</p>
                  <p className="text-xs text-gray-500">Label only — does not filter the flow export</p>
                </div>
                {isAllClusters && <CheckCircle2 className="ml-auto h-4 w-4 text-teal-600 flex-shrink-0" />}
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  !isAllClusters ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <Checkbox
                  checked={!isAllClusters}
                  onCheckedChange={(checked) => { if (checked) handleSpecificToggle() }}
                  className="rounded-full"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Specific clusters</p>
                  <p className="text-xs text-gray-500">Choose clusters to label in the result</p>
                </div>
                {!isAllClusters && <CheckCircle2 className="ml-auto h-4 w-4 text-teal-600 flex-shrink-0" />}
              </label>
            </div>
          </div>

          {!isAllClusters && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Select clusters{' '}
                <span className="font-normal text-gray-500">({selectedIds.length} selected)</span>
              </Label>

              {clustersLoading && (
                <div className="flex items-center gap-2 py-4 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading NiFi clusters...</span>
                </div>
              )}

              {clustersError && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    Failed to load NiFi clusters.
                  </AlertDescription>
                </Alert>
              )}

              {!clustersLoading && !clustersError && clusters.length === 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    No NiFi clusters registered yet.
                  </AlertDescription>
                </Alert>
              )}

              {!clustersLoading && !clustersError && clusters.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {clusters.map((cluster) => {
                    const checked = selectedIds.includes(cluster.id)
                    return (
                      <label
                        key={cluster.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          checked ? 'bg-teal-50' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => handleClusterToggle(cluster.id, !!value)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{cluster.cluster_id}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {cluster.hierarchy_attribute}: {cluster.hierarchy_value}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0 text-gray-500">
                          {cluster.members.length} instance{cluster.members.length !== 1 ? 's' : ''}
                        </Badge>
                      </label>
                    )
                  })}
                </div>
              )}

              {selectedClusters.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedClusters.map((c) => (
                    <Badge key={c.id} className="bg-teal-100 text-teal-800 border-teal-300 text-xs">
                      {getClusterLabel(c)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Flows to Export ──────────────────────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-teal-400/80 to-teal-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Flows to Export</span>
          </div>
          <div className="text-xs text-teal-100">Choose all flows or apply hierarchy filters</div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* All / Specific toggle */}
          <div className="flex flex-col gap-2">
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                allFlows ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <Checkbox
                checked={allFlows}
                onCheckedChange={(checked) => { if (checked) onAllFlowsChange(true) }}
                className="rounded-full"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">All Flows</p>
                <p className="text-xs text-gray-500">Export every flow in the local database</p>
              </div>
              {allFlows && <CheckCircle2 className="ml-auto h-4 w-4 text-teal-600 flex-shrink-0" />}
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                !allFlows ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <Checkbox
                checked={!allFlows}
                onCheckedChange={(checked) => { if (checked) onAllFlowsChange(false) }}
                className="rounded-full"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Specific Flows</p>
                <p className="text-xs text-gray-500">Apply hierarchy filters to narrow down which flows to export</p>
              </div>
              {!allFlows && <CheckCircle2 className="ml-auto h-4 w-4 text-teal-600 flex-shrink-0" />}
            </label>
          </div>

          {/* Filter section – only shown in specific mode */}
          {!allFlows && (
            <div className="space-y-4 pt-2">
              {hierLoading && (
                <div className="flex items-center gap-2 py-3 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading hierarchy attributes…</span>
                </div>
              )}

              {!hierLoading && hierarchyEntries.length === 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    No hierarchy attributes found. Import flows first.
                  </AlertDescription>
                </Alert>
              )}

              {!hierLoading && hierarchyEntries.map(([attrName, sides]) => {
                const currentFilter = filters[attrName] ?? { source: [], destination: [] }
                return (
                  <div key={attrName} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">{attrName}</p>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Source */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Source</p>
                        {sides.source.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No values</p>
                        ) : (
                          sides.source.map((val) => (
                            <label key={val} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={currentFilter.source.includes(val)}
                                onCheckedChange={(checked) =>
                                  handleFilterSideToggle(attrName, 'source', val, !!checked)
                                }
                                className="h-3.5 w-3.5"
                              />
                              <span className="text-sm text-gray-700">{val}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {/* Destination */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Destination</p>
                        {sides.destination.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No values</p>
                        ) : (
                          sides.destination.map((val) => (
                            <label key={val} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={currentFilter.destination.includes(val)}
                                onCheckedChange={(checked) =>
                                  handleFilterSideToggle(attrName, 'destination', val, !!checked)
                                }
                                className="h-3.5 w-3.5"
                              />
                              <span className="text-sm text-gray-700">{val}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Check filter button */}
              {!hierLoading && hierarchyEntries.length > 0 && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCheckFilter}
                    disabled={filterMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {filterMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Check Filter
                  </Button>
                  {filterMatchCount !== null && !filterMutation.isPending && (
                    <span className="text-sm text-gray-600">
                      <span className="font-semibold text-teal-700">{filterMatchCount}</span> flow
                      {filterMatchCount !== 1 ? 's' : ''} match
                    </span>
                  )}
                  {filterMutation.isError && (
                    <span className="text-sm text-red-600">Failed to check filter</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Export Destination ──────────────────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-teal-400/80 to-teal-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-4 w-4" />
            <span className="text-sm font-medium">Export Destination</span>
          </div>
          <div className="text-xs text-teal-100">Configure the output file and git repository</div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* Git Repository */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Export to Repository</Label>
            {reposLoading ? (
              <div className="flex items-center gap-2 py-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading repositories…</span>
              </div>
            ) : (
              <>
                {exportRepos.length === 0 && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      No &quot;Export&quot; repositories configured. Add one in Settings → Git.
                    </AlertDescription>
                  </Alert>
                )}
                <Select
                  value={gitRepoId !== null ? String(gitRepoId) : ''}
                  onValueChange={(val) => onGitRepoIdChange(val ? Number(val) : null)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select a repository…" />
                  </SelectTrigger>
                  <SelectContent>
                    {exportRepos.map((repo) => (
                      <SelectItem key={repo.id} value={String(repo.id)}>
                        {repo.name}
                        {repo.branch && (
                          <span className="ml-1.5 text-xs text-gray-400">({repo.branch})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRepo && (
                  <p className="text-xs text-gray-500">{selectedRepo.url}</p>
                )}
              </>
            )}
          </div>

          {/* Filename */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Filename
            </Label>
            <p className="text-xs text-gray-500 -mt-1">
              The correct extension is appended automatically if missing.
            </p>
            <Input
              type="text"
              placeholder="e.g. nifi_flows"
              value={filename}
              onChange={(e) => onFilenameChange(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Export Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Export Format</Label>
            <div className="flex gap-2">
              {(['json', 'csv'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onExportTypeChange(fmt)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    exportType === fmt
                      ? 'border-teal-400 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Push to Git */}
          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            pushToGit ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}>
            <Checkbox
              checked={pushToGit}
              onCheckedChange={(checked) => onPushToGitChange(!!checked)}
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Push to git after export</p>
              <p className="text-xs text-gray-500">Commit and push the exported file to the remote repository</p>
            </div>
            {pushToGit && <CheckCircle2 className="ml-auto h-4 w-4 text-teal-600 flex-shrink-0" />}
          </label>
        </div>
      </div>
    </div>
  )
}
