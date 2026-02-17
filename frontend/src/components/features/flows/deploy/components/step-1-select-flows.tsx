'use client'

import { useMemo, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { NifiFlow } from '@/components/features/flows/manage/types'

interface Step1SelectFlowsProps {
  flows: NifiFlow[]
  selectedFlowIds: number[]
  onToggleFlow: (flowId: number) => void
  onToggleSelectAll: () => void
  isLoading?: boolean
  error?: Error | null
}

export function Step1SelectFlows({
  flows,
  selectedFlowIds,
  onToggleFlow,
  onToggleSelectAll,
  isLoading = false,
  error = null,
}: Step1SelectFlowsProps) {
  // Check if all flows are selected
  const allSelected = useMemo(() => {
    if (flows.length === 0) return false
    return flows.every((flow) => selectedFlowIds.includes(flow.id))
  }, [flows, selectedFlowIds])

  // Check if some (but not all) flows are selected
  const someSelected = useMemo(() => {
    return selectedFlowIds.length > 0 && !allSelected
  }, [selectedFlowIds.length, allSelected])

  // Create stable handlers
  const handleToggleFlow = useCallback(
    (flowId: number) => {
      onToggleFlow(flowId)
    },
    [onToggleFlow]
  )

  const handleToggleSelectAll = useCallback(() => {
    onToggleSelectAll()
  }, [onToggleSelectAll])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Failed to load flows: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (flows.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No flows available. Please create flows in the Flows → Manage page first.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Select the flows you want to deploy ({selectedFlowIds.length} selected)
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleSelectAll}
          disabled={flows.length === 0}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleToggleSelectAll}
                  disabled={flows.length === 0}
                  aria-label="Select all flows"
                  className={someSelected ? 'data-[state=checked]:bg-slate-400' : ''}
                />
              </TableHead>
              <TableHead>Flow Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source Template</TableHead>
              <TableHead>Destination Template</TableHead>
              <TableHead>Hierarchy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flows.map((flow) => (
              <TableRow key={flow.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedFlowIds.includes(flow.id)}
                    onCheckedChange={() => handleToggleFlow(flow.id)}
                    aria-label={`Select ${flow.name || 'Unnamed flow'}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {flow.name || (
                    <span className="text-slate-400 italic">Unnamed</span>
                  )}
                </TableCell>
                <TableCell>{flow.contact || '—'}</TableCell>
                <TableCell>
                  {flow.src_template_id ? (
                    <Badge variant="outline">Template {flow.src_template_id}</Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {flow.dest_template_id ? (
                    <Badge variant="outline">Template {flow.dest_template_id}</Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(flow.hierarchy_values || {}).map(([key, values]) => {
                      const source = values?.source
                      const destination = values?.destination
                      return (
                        <div key={key} className="flex items-center gap-1 text-xs">
                          <span className="text-slate-500">{key}:</span>
                          {source && (
                            <Badge variant="secondary" className="text-xs">
                              {source}
                            </Badge>
                          )}
                          {destination && destination !== source && (
                            <>
                              <span className="text-slate-400">→</span>
                              <Badge variant="secondary" className="text-xs">
                                {destination}
                              </Badge>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
