'use client'

import { useCallback } from 'react'
import { ArrowRight, ArrowLeft, ArrowLeftRight, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { NifiFlow } from '@/components/features/flows/manage/types'

interface Step2ChooseTargetsProps {
  flows: NifiFlow[]
  selectedFlowIds: number[]
  deploymentTargets: Record<number, 'source' | 'destination' | 'both'>
  onSetTarget: (flowId: number, target: 'source' | 'destination' | 'both') => void
}

export function Step2ChooseTargets({
  flows,
  selectedFlowIds,
  deploymentTargets,
  onSetTarget,
}: Step2ChooseTargetsProps) {
  const selectedFlows = flows.filter((flow) => selectedFlowIds.includes(flow.id))

  const handleSetTarget = useCallback(
    (flowId: number, target: 'source' | 'destination' | 'both') => {
      onSetTarget(flowId, target)
    },
    [onSetTarget]
  )

  if (selectedFlows.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No flows selected. Go back to Step 1 to select flows.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {selectedFlows.map((flow) => {
        const currentTarget = deploymentTargets[flow.id]
        const hierarchyEntries = Object.entries(flow.hierarchy_values || {})

        // Top hierarchy level and values
        const topHierarchy = hierarchyEntries[0]
        const hierarchyLabel = topHierarchy?.[0] // e.g. "DC"
        const sourceValue = topHierarchy?.[1]?.source // e.g. "NET"
        const destinationValue = topHierarchy?.[1]?.destination // e.g. "NET"

        return (
          <div key={flow.id} className="rounded-lg border bg-white">
            {/* Flow header */}
            <div className="border-b px-5 py-4">
              <p className="font-semibold text-slate-900">{flow.name || `Flow ${flow.id}`}</p>
              <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
            </div>

            {/* Hierarchy info + target buttons */}
            <div className="space-y-4 px-5 py-4">
              {/* Hierarchy badges */}
              {topHierarchy && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">
                    Top Hierarchy ({hierarchyLabel}):
                  </span>
                  {sourceValue && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      Source: {sourceValue}
                    </Badge>
                  )}
                  {destinationValue && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      Dest: {destinationValue}
                    </Badge>
                  )}
                </div>
              )}

              {/* Deploy-to buttons */}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Deploy to:</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={currentTarget === 'source' ? 'default' : 'outline'}
                    onClick={() => handleSetTarget(flow.id, 'source')}
                    disabled={!flow.src_template_id}
                    className={
                      currentTarget === 'source'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : ''
                    }
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Source{sourceValue ? ` (${sourceValue})` : ''}
                  </Button>
                  <Button
                    variant={currentTarget === 'destination' ? 'default' : 'outline'}
                    onClick={() => handleSetTarget(flow.id, 'destination')}
                    disabled={!flow.dest_template_id}
                    className={
                      currentTarget === 'destination'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : ''
                    }
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Destination{destinationValue ? ` (${destinationValue})` : ''}
                  </Button>
                  <Button
                    variant={currentTarget === 'both' ? 'default' : 'outline'}
                    onClick={() => handleSetTarget(flow.id, 'both')}
                    disabled={!flow.src_template_id || !flow.dest_template_id}
                    className={
                      currentTarget === 'both'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : ''
                    }
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Both
                  </Button>
                </div>

                {!flow.src_template_id && !flow.dest_template_id && (
                  <p className="mt-2 text-sm text-amber-600">
                    ⚠️ This flow has no templates configured
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
