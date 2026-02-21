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
  const allSelected = useMemo(() => {
    if (flows.length === 0) return false
    return flows.every((flow) => selectedFlowIds.includes(flow.id))
  }, [flows, selectedFlowIds])

  const someSelected = useMemo(() => {
    return selectedFlowIds.length > 0 && !allSelected
  }, [selectedFlowIds.length, allSelected])

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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="bg-red-50 border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Failed to load flows: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  if (flows.length === 0) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          No flows available. Please create flows in the Flows → Manage page first.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
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

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleToggleSelectAll}
                  disabled={flows.length === 0}
                  aria-label="Select all flows"
                  className={someSelected ? 'data-[state=checked]:bg-slate-400' : ''}
                />
              </TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-xs tracking-wide">Flow Name</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-xs tracking-wide">Contact</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-xs tracking-wide">Source Template</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-xs tracking-wide">Destination Template</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-xs tracking-wide">Hierarchy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flows.map((flow) => (
              <TableRow key={flow.id} className="hover:bg-gray-50">
                <TableCell>
                  <Checkbox
                    checked={selectedFlowIds.includes(flow.id)}
                    onCheckedChange={() => handleToggleFlow(flow.id)}
                    aria-label={`Select ${flow.name || 'Unnamed flow'}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {flow.name || (
                    <span className="text-gray-400 italic">Unnamed</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{flow.contact || '—'}</TableCell>
                <TableCell>
                  {flow.src_template_id ? (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300">Template {flow.src_template_id}</Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {flow.dest_template_id ? (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300">Template {flow.dest_template_id}</Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(flow.hierarchy_values || {}).map(([key, values]) => {
                      const source = values?.source
                      const destination = values?.destination
                      return (
                        <div key={key} className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">{key}:</span>
                          {source && (
                            <Badge variant="secondary" className="text-xs">
                              {source}
                            </Badge>
                          )}
                          {destination && destination !== source && (
                            <>
                              <span className="text-gray-400">→</span>
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
