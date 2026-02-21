'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GitFork, Plus, Upload, Trash2, Download, ChevronDown, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useNifiInstancesQuery } from '../nifi/hooks/use-nifi-instances-query'
import { useRegistryFlowsQuery } from './hooks/use-registry-flows-query'
import { useRegistryFlowsMutations } from './hooks/use-registry-flows-mutations'
import { AddFlowDialog } from './dialogs/add-flow-dialog'
import { ImportFlowDialog } from './dialogs/import-flow-dialog'
import { FlowVersionsDialog } from './dialogs/flow-versions-dialog'
import type { RegistryFlow } from './types'
import type { NifiInstance } from '../nifi/types'

const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_FLOWS: RegistryFlow[] = []

export function RegistryFlowsPage() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi', 'write')
  const canDelete = hasPermission(user, 'nifi', 'delete')

  const [filterInstanceId, setFilterInstanceId] = useState<number | undefined>(undefined)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [versionsFlow, setVersionsFlow] = useState<RegistryFlow | null>(null)
  const [deleteFlow, setDeleteFlow] = useState<RegistryFlow | null>(null)
  const [exportingIds, setExportingIds] = useState<Set<string>>(new Set())

  const { data: instances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const { data: flows = EMPTY_FLOWS, isLoading } = useRegistryFlowsQuery(filterInstanceId)
  const { deleteFlow: deleteFlowMutation, exportFlow } = useRegistryFlowsMutations()

  const filterOptions = useMemo(() => [
    { value: '__all__', label: 'All Instances' },
    ...instances.map(i => ({ value: String(i.id), label: `${i.hierarchy_value} (${i.nifi_url})` })),
  ], [instances])

  const handleFilterChange = useCallback((val: string) => {
    setFilterInstanceId(val === '__all__' ? undefined : Number(val))
  }, [])

  const handleExport = useCallback(async (flow: RegistryFlow, format: 'json' | 'yaml') => {
    const key = `${flow.registry_id}_${flow.bucket_id}_${flow.flow_id}`
    setExportingIds(prev => new Set(prev).add(key))
    try {
      await exportFlow(flow.nifi_instance_id, flow.registry_id, flow.bucket_id, flow.flow_id, flow.flow_name, format)
    } finally {
      setExportingIds(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }, [exportFlow])

  const handleDelete = useCallback(async () => {
    if (!deleteFlow) return
    await deleteFlowMutation.mutateAsync(deleteFlow.id)
    setDeleteFlow(null)
  }, [deleteFlow, deleteFlowMutation])

  const versionsInstanceId = useMemo(
    () => versionsFlow ? instances.find(i => i.nifi_url === versionsFlow.nifi_instance_url)?.id ?? null : null,
    [versionsFlow, instances]
  )

  const pageHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <GitFork className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Registry Flows</h1>
          <p className="text-muted-foreground mt-2">Manage NiFi Registry flow references</p>
        </div>
      </div>
      {canWrite && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import Flow
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Flow
          </Button>
        </div>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      {/* Main Content Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <GitFork className="h-4 w-4" />
            <span className="text-sm font-medium">Flow References</span>
          </div>
          <div className="text-xs text-blue-100">
            {flows.length} flow{flows.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {/* Filter */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-72">
              <Select onValueChange={handleFilterChange} defaultValue="__all__">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filterOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Showing {flows.length} flow{flows.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Empty state */}
          {flows.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No Registry Flows</p>
              <p className="text-sm mt-1">
                {canWrite ? 'Click "Add Flow" to get started.' : 'No flows configured yet.'}
              </p>
              {canWrite && (
                <Button onClick={() => setAddOpen(true)} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" /> Add Flow
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          {flows.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold text-slate-600 uppercase text-xs tracking-wide">Flow Name</TableHead>
                    <TableHead className="font-semibold text-slate-600 uppercase text-xs tracking-wide">NiFi Instance</TableHead>
                    <TableHead className="font-semibold text-slate-600 uppercase text-xs tracking-wide">Registry</TableHead>
                    <TableHead className="font-semibold text-slate-600 uppercase text-xs tracking-wide">Bucket</TableHead>
                    <TableHead className="font-semibold text-slate-600 uppercase text-xs tracking-wide">Description</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600 uppercase text-xs tracking-wide">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flows.map(flow => {
                    const exportKey = `${flow.registry_id}_${flow.bucket_id}_${flow.flow_id}`
                    const isExporting = exportingIds.has(exportKey)
                    return (
                      <TableRow key={flow.id} className="hover:bg-slate-50">
                        <TableCell>
                          <button
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left"
                            onClick={() => setVersionsFlow(flow)}
                          >
                            {flow.flow_name}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{flow.nifi_instance_name}</TableCell>
                        <TableCell className="text-sm text-slate-600">{flow.registry_name}</TableCell>
                        <TableCell className="text-sm text-slate-600">{flow.bucket_name}</TableCell>
                        <TableCell className="text-sm text-slate-400 max-w-xs truncate">
                          {flow.flow_description || 'No description'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(canWrite || canDelete) ? (
                            <div className="flex items-center justify-end gap-1">
                              {canWrite && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={isExporting}>
                                      {isExporting
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <><Download className="h-3.5 w-3.5" /><ChevronDown className="h-3 w-3 ml-1" /></>}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleExport(flow, 'json')}>
                                      Export as JSON
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport(flow, 'yaml')}>
                                      Export as YAML
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                  onClick={() => setDeleteFlow(flow)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs text-slate-400">Read only</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddFlowDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportFlowDialog open={importOpen} onOpenChange={setImportOpen} />
      <FlowVersionsDialog
        flow={versionsFlow}
        instanceId={versionsInstanceId}
        onClose={() => setVersionsFlow(null)}
      />

      <AlertDialog open={!!deleteFlow} onOpenChange={o => !o && setDeleteFlow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Registry Flow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteFlow?.flow_name}</strong>? This only removes the reference — the flow in the registry is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
