'use client'

import { useMemo, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertCircle, Server, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNifiInstances } from '../hooks/use-template-queries'
import { EMPTY_NIFI_INSTANCES } from '../utils/constants'
import type { NifiInstance } from '../types'

// Stable empty array constant - prevents re-render loops
const EMPTY_IDS: number[] = []

interface CheckQueuesFieldsProps {
  /** null = all instances; array of IDs = specific instances */
  nifiInstanceIds: number[] | null
  onNifiInstanceIdsChange: (ids: number[] | null) => void
}

function getInstanceLabel(instance: NifiInstance): string {
  if (instance.name) return instance.name
  return `${instance.hierarchy_attribute}: ${instance.hierarchy_value}`
}

export function CheckQueuesFields({
  nifiInstanceIds,
  onNifiInstanceIdsChange,
}: CheckQueuesFieldsProps) {
  const { data: instances = EMPTY_NIFI_INSTANCES, isLoading, isError } = useNifiInstances()

  const isAllInstances = nifiInstanceIds === null
  const selectedIds = nifiInstanceIds ?? EMPTY_IDS

  const handleAllToggle = useCallback(() => {
    // Switch to "All" → clear selection
    onNifiInstanceIdsChange(null)
  }, [onNifiInstanceIdsChange])

  const handleSpecificToggle = useCallback(() => {
    // Switch to "Specific" → start with empty selection
    onNifiInstanceIdsChange([])
  }, [onNifiInstanceIdsChange])

  const handleInstanceToggle = useCallback(
    (instanceId: number, checked: boolean) => {
      if (checked) {
        onNifiInstanceIdsChange([...selectedIds, instanceId])
      } else {
        const next = selectedIds.filter((id) => id !== instanceId)
        // If all deselected, keep as empty array (not null — null = all)
        onNifiInstanceIdsChange(next)
      }
    },
    [selectedIds, onNifiInstanceIdsChange]
  )

  const selectedInstances = useMemo(
    () => instances.filter((inst) => selectedIds.includes(inst.id)),
    [instances, selectedIds]
  )

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Section header — gradient style per design system */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">NiFi Instances</span>
        </div>
        <div className="text-xs text-blue-100">
          Select the instances this job will target
        </div>
      </div>

      <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        {/* Scope selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Target Instances</Label>

          <div className="flex flex-col gap-2">
            {/* All instances option */}
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

            {/* Specific instances option */}
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
                <p className="text-xs text-gray-500">
                  Choose which NiFi instances to target
                </p>
              </div>
              {!isAllInstances && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-blue-600 flex-shrink-0" />
              )}
            </label>
          </div>
        </div>

        {/* Instance list — only shown when specific mode */}
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

            {/* Selected summary badges */}
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
                No instances selected — the job will not run against any instance until you select at least one.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
