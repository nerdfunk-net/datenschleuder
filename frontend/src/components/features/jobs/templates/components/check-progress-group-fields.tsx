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
import { useNifiInstances, useNifiProcessGroups } from '../hooks/use-template-queries'
import { EMPTY_NIFI_INSTANCES, EMPTY_PROCESS_GROUPS } from '../utils/constants'
import type { NifiInstance } from '../types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExpectedStatus = 'Running' | 'Stopped' | 'Enabled' | 'Disabled'

const EXPECTED_STATUS_OPTIONS: { value: ExpectedStatus; label: string; color: string }[] = [
  { value: 'Running', label: 'Running', color: 'text-green-600' },
  { value: 'Stopped', label: 'Stopped', color: 'text-gray-500' },
  { value: 'Enabled', label: 'Enabled', color: 'text-blue-600' },
  { value: 'Disabled', label: 'Disabled', color: 'text-red-500' },
]

export interface CheckProgressGroupFieldsProps {
  /** ID of the selected NiFi instance (null = none selected yet) */
  nifiInstanceId: number | null
  onNifiInstanceIdChange: (id: number | null) => void

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

function getInstanceLabel(instance: NifiInstance): string {
  if (instance.name) return instance.name
  return `${instance.hierarchy_attribute}: ${instance.hierarchy_value}`
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CheckProgressGroupFields({
  nifiInstanceId,
  onNifiInstanceIdChange,
  processGroupId,
  processGroupPath,
  onProcessGroupChange,
  checkChildren,
  onCheckChildrenChange,
  expectedStatus,
  onExpectedStatusChange,
}: CheckProgressGroupFieldsProps) {
  // ── Instances ──────────────────────────────────────────────────────────────
  const {
    data: instances = EMPTY_NIFI_INSTANCES,
    isLoading: instancesLoading,
    isError: instancesError,
  } = useNifiInstances()

  // ── Process groups – only fetched when an instance is selected ─────────────
  const {
    data: processGroups = EMPTY_PROCESS_GROUPS,
    isLoading: processGroupsLoading,
    isError: processGroupsError,
  } = useNifiProcessGroups({ instanceId: nifiInstanceId })

  // Sorted by path for a tree-like visual order
  const sortedProcessGroups = useMemo(
    () => [...processGroups].sort((a, b) => a.path.localeCompare(b.path)),
    [processGroups]
  )

  const handleInstanceChange = useCallback(
    (value: string) => {
      const id = Number(value)
      onNifiInstanceIdChange(id)
      // Reset process group selection when instance changes
      onProcessGroupChange(null, null)
    },
    [onNifiInstanceIdChange, onProcessGroupChange]
  )

  const handleProcessGroupChange = useCallback(
    (value: string) => {
      const pg = processGroups.find((g) => g.id === value) ?? null
      onProcessGroupChange(pg?.id ?? null, pg?.formatted_path ?? null)
    },
    [processGroups, onProcessGroupChange]
  )

  // ── Derived values ─────────────────────────────────────────────────────────

  const selectedInstance = useMemo(
    () => instances.find((i) => i.id === nifiInstanceId) ?? null,
    [instances, nifiInstanceId]
  )

  const selectedProcessGroup = useMemo(
    () => processGroups.find((pg) => pg.id === processGroupId) ?? null,
    [processGroups, processGroupId]
  )

  return (
    <div className="space-y-4">
      {/* ── NiFi Instance (single selection) ──────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">NiFi Instance</span>
          </div>
          <div className="text-xs text-blue-100">Select exactly one NiFi instance to target</div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {instancesLoading && (
            <div className="flex items-center gap-2 py-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading NiFi instances…</span>
            </div>
          )}

          {instancesError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load NiFi instances. Check your connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {!instancesLoading && !instancesError && instances.length === 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No NiFi instances are registered. Add instances in the NiFi settings first.
              </AlertDescription>
            </Alert>
          )}

          {!instancesLoading && !instancesError && instances.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Instance</Label>
              <Select
                value={nifiInstanceId !== null ? String(nifiInstanceId) : ''}
                onValueChange={handleInstanceChange}
              >
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue placeholder="Select a NiFi instance…" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={String(inst.id)}>
                      <div className="flex items-center gap-2">
                        {nifiInstanceId === inst.id ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Server className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="font-medium">{getInstanceLabel(inst)}</span>
                        <span className="text-xs text-gray-400 truncate">{inst.nifi_url}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedInstance && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-blue-700">{getInstanceLabel(selectedInstance)}</span>
                  {' · '}
                  {selectedInstance.nifi_url}
                </p>
              )}

              {nifiInstanceId === null && (
                <p className="text-xs text-amber-600">
                  Select an instance to load the available process groups.
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
          {/* Not yet selected an instance */}
          {nifiInstanceId === null && (
            <p className="text-sm text-gray-400 italic">
              Select a NiFi instance above to load process groups.
            </p>
          )}

          {/* Loading process groups */}
          {nifiInstanceId !== null && processGroupsLoading && (
            <div className="flex items-center gap-2 py-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading process groups…</span>
            </div>
          )}

          {/* Error loading process groups */}
          {nifiInstanceId !== null && processGroupsError && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load process groups. Check the NiFi connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* No process groups returned */}
          {nifiInstanceId !== null && !processGroupsLoading && !processGroupsError && processGroups.length === 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No process groups found for this instance.
              </AlertDescription>
            </Alert>
          )}

          {/* Process group selector */}
          {nifiInstanceId !== null && !processGroupsLoading && !processGroupsError && processGroups.length > 0 && (
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
