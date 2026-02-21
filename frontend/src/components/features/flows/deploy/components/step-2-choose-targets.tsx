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
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          No flows selected. Go back to Step 1 to select flows.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {selectedFlows.map((flow) => {
        const currentTarget = deploymentTargets[flow.id]
        const hierarchyEntries = Object.entries(flow.hierarchy_values || {})

        const topHierarchy = hierarchyEntries[0]
        const hierarchyLabel = topHierarchy?.[0]
        const sourceValue = topHierarchy?.[1]?.source
        const destinationValue = topHierarchy?.[1]?.destination

        return (
          <div key={flow.id} className="shadow-lg border-0 p-0 bg-white rounded-lg">
            {/* Flow gradient header */}
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{flow.name || `Flow ${flow.id}`}</span>
              </div>
              {topHierarchy && (
                <div className="flex items-center gap-2">
                  {sourceValue && (
                    <Badge className="bg-white/20 text-white border-white/30 text-xs">
                      {hierarchyLabel}: {sourceValue}
                      {destinationValue && destinationValue !== sourceValue && ` → ${destinationValue}`}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              {/* Hierarchy info */}
              {topHierarchy && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    Top Hierarchy ({hierarchyLabel}):
                  </span>
                  {sourceValue && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                      Source: {sourceValue}
                    </Badge>
                  )}
                  {destinationValue && (
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      Dest: {destinationValue}
                    </Badge>
                  )}
                </div>
              )}

              {/* Deploy-to buttons */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Deploy to:</p>
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
