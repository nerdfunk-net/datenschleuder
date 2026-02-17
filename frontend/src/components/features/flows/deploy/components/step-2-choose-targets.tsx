'use client'

import { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, ArrowLeft, ArrowLeftRight, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Choose deployment direction for each flow. You can deploy to source, destination, or both
        instances.
      </p>

      <div className="grid gap-4">
        {selectedFlows.map((flow) => {
          const currentTarget = deploymentTargets[flow.id]
          const hierarchyEntries = Object.entries(flow.hierarchy_values || {})
          
          // Get top hierarchy (e.g., DC) for display
          const topHierarchy = hierarchyEntries[0]
          const sourceValue = topHierarchy?.[1]?.source
          const destinationValue = topHierarchy?.[1]?.destination

          return (
            <Card key={flow.id} className={currentTarget ? 'border-blue-200' : ''}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{flow.name || `Flow ${flow.id}`}</span>
                  {currentTarget && (
                    <Badge variant="default" className="ml-2">
                      {currentTarget === 'both' ? 'Source & Destination' : currentTarget}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Flow Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Source:</span>
                    <div className="mt-1">
                      <Badge variant="secondary">{sourceValue || 'N/A'}</Badge>
                      {flow.src_template_id && (
                        <span className="ml-2 text-xs text-slate-500">
                          Template {flow.src_template_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Destination:</span>
                    <div className="mt-1">
                      <Badge variant="secondary">{destinationValue || 'N/A'}</Badge>
                      {flow.dest_template_id && (
                        <span className="ml-2 text-xs text-slate-500">
                          Template {flow.dest_template_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Target Selection Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={currentTarget === 'source' ? 'default' : 'outline'}
                    onClick={() => handleSetTarget(flow.id, 'source')}
                    className="flex items-center justify-center gap-2"
                    disabled={!flow.src_template_id}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Source Only
                  </Button>
                  <Button
                    variant={currentTarget === 'destination' ? 'default' : 'outline'}
                    onClick={() => handleSetTarget(flow.id, 'destination')}
                    className="flex items-center justify-center gap-2"
                    disabled={!flow.dest_template_id}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Destination Only
                  </Button>
                  <Button
                    variant={currentTarget === 'both' ? 'default' : 'outline'}
                    onClick={() => handleSetTarget(flow.id, 'both')}
                    className="flex items-center justify-center gap-2"
                    disabled={!flow.src_template_id || !flow.dest_template_id}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Both
                  </Button>
                </div>

                {/* Validation Messages */}
                {!flow.src_template_id && !flow.dest_template_id && (
                  <p className="text-sm text-amber-600">
                    ⚠️ This flow has no templates configured
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
