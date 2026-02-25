'use client'

import { useMemo, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Loader2, AlertCircle, Server, CheckCircle2, Activity } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNifiInstances } from '../hooks/use-template-queries'
import { EMPTY_NIFI_INSTANCES } from '../utils/constants'
import type { NifiInstance } from '../types'

// Stable empty array constant – prevents re-render loops
const EMPTY_IDS: number[] = []

type CheckMode = 'count' | 'bytes' | 'both'

const CHECK_MODE_OPTIONS: { value: CheckMode; label: string; description: string }[] = [
  { value: 'count', label: 'Count', description: 'Evaluate by flow-file count' },
  { value: 'bytes', label: 'Bytes', description: 'Evaluate by queue size (MB)' },
  { value: 'both', label: 'Both', description: 'Evaluate count and size together' },
]

interface CheckQueuesFieldsProps {
  // ── Instance selection ──────────────────────────────────────────────────
  /** null = all instances; array of IDs = specific instances */
  nifiInstanceIds: number[] | null
  onNifiInstanceIdsChange: (ids: number[] | null) => void

  // ── Check configuration ─────────────────────────────────────────────────
  checkMode: CheckMode
  onCheckModeChange: (mode: CheckMode) => void

  countYellow: number
  onCountYellowChange: (v: number) => void
  countRed: number
  onCountRedChange: (v: number) => void

  bytesYellow: number
  onBytesYellowChange: (v: number) => void
  bytesRed: number
  onBytesRedChange: (v: number) => void
}

function getInstanceLabel(instance: NifiInstance): string {
  if (instance.name) return instance.name
  return `${instance.hierarchy_attribute}: ${instance.hierarchy_value}`
}

// ─── Threshold row helper ───────────────────────────────────────────────────

interface ThresholdRowProps {
  label: string
  unit: string
  yellowValue: number
  redValue: number
  onYellowChange: (v: number) => void
  onRedChange: (v: number) => void
}

function ThresholdRow({
  label,
  unit,
  yellowValue,
  redValue,
  onYellowChange,
  onRedChange,
}: ThresholdRowProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="grid grid-cols-2 gap-3">
        {/* Yellow */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-600">Yellow threshold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              value={yellowValue}
              onChange={(e) => onYellowChange(Math.max(0, Number(e.target.value)))}
              className="h-8 text-sm"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">{unit}</span>
          </div>
        </div>

        {/* Red */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-600">Red threshold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              value={redValue}
              onChange={(e) => onRedChange(Math.max(0, Number(e.target.value)))}
              className="h-8 text-sm"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CheckQueuesFields({
  nifiInstanceIds,
  onNifiInstanceIdsChange,
  checkMode,
  onCheckModeChange,
  countYellow,
  onCountYellowChange,
  countRed,
  onCountRedChange,
  bytesYellow,
  onBytesYellowChange,
  bytesRed,
  onBytesRedChange,
}: CheckQueuesFieldsProps) {
  const { data: instances = EMPTY_NIFI_INSTANCES, isLoading, isError } = useNifiInstances()

  const isAllInstances = nifiInstanceIds === null
  const selectedIds = nifiInstanceIds ?? EMPTY_IDS

  const handleAllToggle = useCallback(() => {
    onNifiInstanceIdsChange(null)
  }, [onNifiInstanceIdsChange])

  const handleSpecificToggle = useCallback(() => {
    onNifiInstanceIdsChange([])
  }, [onNifiInstanceIdsChange])

  const handleInstanceToggle = useCallback(
    (instanceId: number, checked: boolean) => {
      if (checked) {
        onNifiInstanceIdsChange([...selectedIds, instanceId])
      } else {
        onNifiInstanceIdsChange(selectedIds.filter((id) => id !== instanceId))
      }
    },
    [selectedIds, onNifiInstanceIdsChange]
  )

  const selectedInstances = useMemo(
    () => instances.filter((inst) => selectedIds.includes(inst.id)),
    [instances, selectedIds]
  )

  const showCount = checkMode === 'count' || checkMode === 'both'
  const showBytes = checkMode === 'bytes' || checkMode === 'both'

  return (
    <div className="space-y-4">
      {/* ── NiFi Instances ─────────────────────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">NiFi Instances</span>
          </div>
          <div className="text-xs text-blue-100">Select the instances this job will target</div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* Scope selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Target Instances</Label>
            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isAllInstances
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <Checkbox
                  checked={isAllInstances}
                  onCheckedChange={(checked) => {
                    if (checked) handleAllToggle()
                  }}
                  className="rounded-full"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">All instances</p>
                  <p className="text-xs text-gray-500">
                    The job will run against every registered NiFi instance
                  </p>
                </div>
                {isAllInstances && (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  !isAllInstances
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <Checkbox
                  checked={!isAllInstances}
                  onCheckedChange={(checked) => {
                    if (checked) handleSpecificToggle()
                  }}
                  className="rounded-full"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Specific instances</p>
                  <p className="text-xs text-gray-500">Choose which NiFi instances to target</p>
                </div>
                {!isAllInstances && (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
              </label>
            </div>
          </div>

          {/* Instance list – only shown in specific mode */}
          {!isAllInstances && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                Select instances{' '}
                <span className="font-normal text-gray-500">
                  ({selectedIds.length} selected)
                </span>
              </Label>

              {isLoading && (
                <div className="flex items-center gap-2 py-4 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading NiFi instances...</span>
                </div>
              )}

              {isError && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    Failed to load NiFi instances. Check your connection and try again.
                  </AlertDescription>
                </Alert>
              )}

              {!isLoading && !isError && instances.length === 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    No NiFi instances are registered. Add instances in the NiFi settings first.
                  </AlertDescription>
                </Alert>
              )}

              {!isLoading && !isError && instances.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {instances.map((instance) => {
                    const checked = selectedIds.includes(instance.id)
                    return (
                      <label
                        key={instance.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          checked ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            handleInstanceToggle(instance.id, !!value)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {getInstanceLabel(instance)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{instance.nifi_url}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0 text-gray-500"
                        >
                          {instance.hierarchy_attribute}
                        </Badge>
                      </label>
                    )
                  })}
                </div>
              )}

              {selectedInstances.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedInstances.map((inst) => (
                    <Badge
                      key={inst.id}
                      className="bg-blue-100 text-blue-800 border-blue-300 text-xs"
                    >
                      {getInstanceLabel(inst)}
                    </Badge>
                  ))}
                </div>
              )}

              {selectedIds.length === 0 && !isLoading && instances.length > 0 && (
                <p className="text-xs text-amber-600">
                  No instances selected — the job will not run against any instance until you
                  select at least one.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Check Configuration ─────────────────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">Check Configuration</span>
          </div>
          <div className="text-xs text-blue-100">
            Define what metric to evaluate and the alert thresholds
          </div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-5">
          {/* Mode selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Check</Label>
            <p className="text-xs text-gray-500 -mt-1">
              Choose which metric is used to determine queue health
            </p>
            <div className="flex gap-2">
              {CHECK_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onCheckModeChange(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    checkMode === opt.value
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                  <span className="text-[10px] font-normal text-gray-400 leading-tight text-center">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Threshold inputs */}
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              A connection turns{' '}
              <span className="font-semibold text-yellow-600">yellow</span> when its queue
              reaches the yellow threshold, and{' '}
              <span className="font-semibold text-red-600">red</span> when it reaches the red
              threshold. Values are inclusive (≥).
            </p>

            {showCount && (
              <ThresholdRow
                label="Flow-file count thresholds"
                unit="flow files"
                yellowValue={countYellow}
                redValue={countRed}
                onYellowChange={onCountYellowChange}
                onRedChange={onCountRedChange}
              />
            )}

            {showBytes && (
              <ThresholdRow
                label="Queue size thresholds"
                unit="MB"
                yellowValue={bytesYellow}
                redValue={bytesRed}
                onYellowChange={onBytesYellowChange}
                onRedChange={onBytesRedChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
