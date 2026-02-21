'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Columns,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Star,
  Workflow,
  Filter,
  ArrowRightCircle,
  ArrowLeftCircle,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useNifiHierarchyQuery, useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import { useFlowsQuery, useRegistryFlowsQuery, useFlowColumnsQuery } from './hooks/use-flows-query'
import { useFlowsMutations } from './hooks/use-flows-mutations'
import { useFlowViewsQuery } from './hooks/use-flow-views-query'
import { useFlowViewsMutations } from './hooks/use-flow-views-mutations'
import { FlowDialog } from './dialogs/flow-dialog'
import { SaveViewDialog } from './dialogs/save-view-dialog'
import { ConflictResolutionDialog } from '@/components/features/flows/deploy/dialogs/conflict-resolution-dialog'
import { useQuickDeploy } from '@/components/features/flows/deploy/hooks/use-quick-deploy'
import type { NifiFlow, FlowView, FlowColumn, FlowFormValues, RegistryFlow } from './types'
import type { HierarchyAttribute, NifiInstance } from '@/components/features/settings/nifi/types'
import type { FlowPayload } from './hooks/use-flows-mutations'

const EMPTY_COLUMNS: FlowColumn[] = []
const EMPTY_FLOWS: NifiFlow[] = []
const EMPTY_VIEWS: FlowView[] = []
const EMPTY_REGISTRY: RegistryFlow[] = []
const EMPTY_HIERARCHY: HierarchyAttribute[] = []
const EMPTY_INSTANCES: NifiInstance[] = []

const ITEMS_PER_PAGE = 10

function getFlowCellValue(
  flow: NifiFlow,
  columnKey: string,
  hierarchy: HierarchyAttribute[],
  registryFlows: RegistryFlow[],
): string | boolean {
  for (const attr of hierarchy) {
    const key = attr.name.toLowerCase()
    if (columnKey === `src_${key}`) return flow.hierarchy_values?.[attr.name]?.source ?? ''
    if (columnKey === `dest_${key}`) return flow.hierarchy_values?.[attr.name]?.destination ?? ''
  }
  switch (columnKey) {
    case 'name': return flow.name ?? ''
    case 'contact': return flow.contact ?? ''
    case 'active': return flow.active
    case 'src_connection_param': return flow.src_connection_param
    case 'dest_connection_param': return flow.dest_connection_param
    case 'src_template': {
      const tmpl = registryFlows.find(r => r.id === flow.src_template_id)
      return tmpl ? `${tmpl.flow_name} (${tmpl.nifi_instance_name})` : ''
    }
    case 'dest_template': {
      const tmpl = registryFlows.find(r => r.id === flow.dest_template_id)
      return tmpl ? `${tmpl.flow_name} (${tmpl.nifi_instance_name})` : ''
    }
    case 'description': return flow.description ?? ''
    case 'creator_name': return flow.creator_name ?? ''
    case 'created_at': return new Date(flow.created_at).toLocaleDateString()
    default: return ''
  }
}

function formValuesToPayload(values: FlowFormValues): FlowPayload {
  return {
    hierarchy_values: values.hierarchy_values,
    name: values.name || null,
    contact: values.contact || null,
    src_connection_param: values.src_connection_param,
    dest_connection_param: values.dest_connection_param,
    src_template_id: values.src_template_id ? parseInt(values.src_template_id) : null,
    dest_template_id: values.dest_template_id ? parseInt(values.dest_template_id) : null,
    active: values.active,
    description: values.description || null,
  }
}

// ─── Page header (shared between loading and loaded states) ──────────────────

function PageHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Workflow className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Flow Management</h1>
          <p className="text-muted-foreground mt-2">Manage NiFi flows and deployments</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FlowsManagePage() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi', 'write')
  const canDelete = hasPermission(user, 'nifi', 'delete')

  // Data
  const { data: flows = EMPTY_FLOWS, isLoading: flowsLoading } = useFlowsQuery()
  const { data: registryFlows = EMPTY_REGISTRY } = useRegistryFlowsQuery()
  const { data: columnsData } = useFlowColumnsQuery()
  const { data: hierarchyData } = useNifiHierarchyQuery()
  const { data: flowViews = EMPTY_VIEWS } = useFlowViewsQuery()
  const { data: instances = EMPTY_INSTANCES } = useNifiInstancesQuery()

  const hierarchy: HierarchyAttribute[] = useMemo(
    () => hierarchyData?.hierarchy ?? EMPTY_HIERARCHY,
    [hierarchyData],
  )

  const hierAttrsForDeploy = useMemo(
    () => (hierarchyData?.hierarchy ?? []).map((a: { name: string; label: string }, i: number) => ({
      name: a.name,
      label: a.label,
      order: i,
    })),
    [hierarchyData],
  )

  // Mutations
  const { createFlow, updateFlow, deleteFlow, copyFlow } = useFlowsMutations()
  const { createView, updateView, deleteView, setDefaultView } = useFlowViewsMutations()

  // Column state
  const allColumns = useMemo(
    () => columnsData?.columns ?? EMPTY_COLUMNS,
    [columnsData],
  )
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([])
  const columnsInitialized = useRef(false)

  useEffect(() => {
    if (!columnsInitialized.current && allColumns.length > 0) {
      columnsInitialized.current = true
      setVisibleColumnKeys(allColumns.map(c => c.key))
    }
  }, [allColumns])

  const [activeViewId, setActiveViewId] = useState<number | null>(null)

  const [defaultViewApplied, setDefaultViewApplied] = useState(false)
  useEffect(() => {
    if (!defaultViewApplied && flowViews.length > 0 && allColumns.length > 0) {
      const defaultView = flowViews.find(v => v.is_default)
      if (defaultView) {
        setVisibleColumnKeys(defaultView.visible_columns)
        setActiveViewId(defaultView.id)
      }
      setDefaultViewApplied(true)
    }
  }, [flowViews, allColumns, defaultViewApplied])

  const displayedColumns = useMemo(
    () => allColumns.filter(c => visibleColumnKeys.includes(c.key)),
    [allColumns, visibleColumnKeys],
  )

  // Filters
  const [filters, setFilters] = useState<Record<string, string>>({})
  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      return displayedColumns.every(col => {
        const filter = filters[col.key]
        if (!filter) return true
        const value = getFlowCellValue(flow, col.key, hierarchy, registryFlows)
        return String(value).toLowerCase().includes(filter.toLowerCase())
      })
    })
  }, [flows, displayedColumns, filters, hierarchy, registryFlows])

  const totalPages = Math.max(1, Math.ceil(filteredFlows.length / ITEMS_PER_PAGE))

  const paginatedFlows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredFlows.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredFlows, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<NifiFlow | null>(null)
  const [viewOnly, setViewOnly] = useState(false)

  const handleAdd = useCallback(() => {
    setEditingFlow(null)
    setViewOnly(false)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((flow: NifiFlow) => {
    setEditingFlow(flow)
    setViewOnly(false)
    setDialogOpen(true)
  }, [])

  const handleView = useCallback((flow: NifiFlow) => {
    setEditingFlow(flow)
    setViewOnly(true)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingFlow(null)
      setViewOnly(false)
    }
  }, [])

  const handleDialogSubmit = useCallback(
    (values: FlowFormValues, id?: number) => {
      const payload = formValuesToPayload(values)
      if (id) {
        updateFlow.mutate(
          { id, data: payload },
          { onSuccess: () => setDialogOpen(false) },
        )
      } else {
        createFlow.mutate(payload, { onSuccess: () => setDialogOpen(false) })
      }
    },
    [createFlow, updateFlow],
  )

  // Delete confirm
  const [deleteFlowId, setDeleteFlowId] = useState<number | null>(null)
  const handleDeleteConfirm = useCallback(() => {
    if (deleteFlowId !== null) {
      deleteFlow.mutate(deleteFlowId, { onSuccess: () => setDeleteFlowId(null) })
    }
  }, [deleteFlow, deleteFlowId])

  // Column toggle
  const handleToggleColumn = useCallback((key: string) => {
    setVisibleColumnKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    )
    setActiveViewId(null)
  }, [])

  const handleShowAllColumns = useCallback(() => {
    setVisibleColumnKeys(allColumns.map(c => c.key))
    setActiveViewId(null)
  }, [allColumns])

  const handleDeselectAllColumns = useCallback(() => {
    setVisibleColumnKeys([])
    setActiveViewId(null)
  }, [])

  // Views
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [savingViewId, setSavingViewId] = useState<number | null>(null)

  const activeView = useMemo(
    () => flowViews.find(v => v.id === activeViewId) ?? null,
    [flowViews, activeViewId],
  )

  const handleLoadView = useCallback((view: FlowView) => {
    setVisibleColumnKeys(view.visible_columns)
    setActiveViewId(view.id)
    setFilters({})
  }, [])

  const handleOpenSaveView = useCallback((viewId?: number) => {
    setSavingViewId(viewId ?? null)
    setSaveViewOpen(true)
  }, [])

  const handleSaveView = useCallback(
    (name: string, description: string, isDefault: boolean) => {
      const payload = {
        name,
        description: description || null,
        visible_columns: visibleColumnKeys,
        is_default: isDefault,
      }
      if (savingViewId !== null) {
        updateView.mutate(
          { id: savingViewId, data: payload },
          {
            onSuccess: () => {
              setSaveViewOpen(false)
              setActiveViewId(savingViewId)
            },
          },
        )
      } else {
        createView.mutate(payload, {
          onSuccess: (data: unknown) => {
            setSaveViewOpen(false)
            const view = data as FlowView
            if (view?.id) setActiveViewId(view.id)
          },
        })
      }
    },
    [createView, updateView, savingViewId, visibleColumnKeys],
  )

  const handleDeleteView = useCallback(
    (id: number) => {
      deleteView.mutate(id, {
        onSuccess: () => {
          if (activeViewId === id) {
            setActiveViewId(null)
            setVisibleColumnKeys(allColumns.map(c => c.key))
          }
        },
      })
    },
    [deleteView, activeViewId, allColumns],
  )

  const handleSetDefaultView = useCallback(
    (id: number) => {
      setDefaultView.mutate(id)
    },
    [setDefaultView],
  )

  // Quick deploy
  const {
    quickDeploy,
    deployingFlows,
    showConflictDialog,
    setShowConflictDialog,
    currentConflict,
    isResolvingConflict,
    handleSkipConflict,
    handleDeleteConflict,
    handleUpdateConflict,
  } = useQuickDeploy({
    instances: instances as unknown as Parameters<typeof useQuickDeploy>[0]['instances'],
    registryFlows,
    hierarchyAttributes: hierAttrsForDeploy,
  })

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (flowsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const isSubmitting = createFlow.isPending || updateFlow.isPending
  const isSavingView = createView.isPending || updateView.isPending

  // ─── Toolbar buttons (shared) ────────────────────────────────────────────────
  const toolbar = (
    <div className="flex items-center gap-2">
      {/* Column visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns className="mr-2 h-4 w-4" />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleShowAllColumns}>Select All</DropdownMenuItem>
          <DropdownMenuItem onClick={handleDeselectAllColumns}>Deselect All</DropdownMenuItem>
          <DropdownMenuSeparator />
          {allColumns.map(col => (
            <DropdownMenuCheckboxItem
              key={col.key}
              checked={visibleColumnKeys.includes(col.key)}
              onCheckedChange={() => handleToggleColumn(col.key)}
              onSelect={e => e.preventDefault()}
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Views */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <BookmarkCheck className="mr-2 h-4 w-4" />
            Views
            {activeView && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeView.name}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canWrite && (
            <>
              <DropdownMenuItem onClick={() => handleOpenSaveView()}>
                <Plus className="mr-2 h-4 w-4" />
                Save current as new view
              </DropdownMenuItem>
              {activeView && (
                <DropdownMenuItem onClick={() => handleOpenSaveView(activeView.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Update &ldquo;{activeView.name}&rdquo;
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          {flowViews.length === 0 && (
            <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
          )}
          {flowViews.map(view => (
            <div key={view.id} className="flex items-center group">
              <DropdownMenuItem className="flex-1" onClick={() => handleLoadView(view)}>
                {view.is_default && <Star className="mr-1.5 h-3 w-3 text-amber-400" />}
                <span className={activeViewId === view.id ? 'font-semibold' : ''}>
                  {view.name}
                </span>
              </DropdownMenuItem>
              {canWrite && (
                <div className="flex pr-1 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!view.is_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={e => { e.preventDefault(); handleSetDefaultView(view.id) }}
                      title="Set as default"
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500"
                      onClick={e => { e.preventDefault(); handleDeleteView(view.id) }}
                      title="Delete view"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite && (
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Flow
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader>{toolbar}</PageHeader>

      {/* Filters section */}
      {flows.length > 0 && displayedColumns.length > 0 && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            {hasActiveFilters && (
              <button
                className="text-xs text-blue-100 hover:text-white transition-colors"
                onClick={() => setFilters({})}
              >
                Clear All
              </button>
            )}
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${Math.min(displayedColumns.length, 4)}, 1fr)` }}
            >
              {displayedColumns.map(col => (
                <div key={col.key} className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{col.label}</label>
                  <Input
                    className="h-8 text-sm"
                    placeholder={`Filter ${col.label}`}
                    value={filters[col.key] ?? ''}
                    onChange={e => handleFilterChange(col.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {flows.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Workflow className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No Flows</p>
          <p className="text-sm mt-1">
            {canWrite ? 'Add your first flow to get started.' : 'No flows configured yet.'}
          </p>
          {canWrite && (
            <Button className="mt-4" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Flow
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {flows.length > 0 && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Workflow className="h-4 w-4" />
              <span className="text-sm font-medium">Flows</span>
            </div>
            <div className="text-xs text-blue-100">
              {filteredFlows.length} flow{filteredFlows.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-16 font-bold text-slate-600 uppercase text-xs tracking-wide">ID</TableHead>
                  {displayedColumns.map(col => (
                    <TableHead key={col.key} className="min-w-[120px] font-bold text-slate-600 uppercase text-xs tracking-wide">
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-bold text-slate-600 uppercase text-xs tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFlows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={displayedColumns.length + 2}
                      className="text-center text-gray-500 py-8"
                    >
                      No flows match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedFlows.map(flow => (
                    <TableRow key={flow.id} className="hover:bg-gray-50">
                      <TableCell className="text-slate-500 text-sm">{flow.id}</TableCell>
                      {displayedColumns.map(col => {
                        const value = getFlowCellValue(flow, col.key, hierarchy, registryFlows)
                        return (
                          <TableCell key={col.key} className="max-w-[200px] truncate">
                            {col.key === 'active' ? (
                              <Badge className={value
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : 'bg-red-100 text-red-800 border-red-300'
                              }>
                                {value ? 'Active' : 'Inactive'}
                              </Badge>
                            ) : (
                              String(value)
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Deploy to Source */}
                          {flow.src_template_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Deploy to Source"
                              className="h-8 w-8 p-0 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                              disabled={!!deployingFlows[`${flow.id}-source`]}
                              onClick={() => quickDeploy(flow, 'source')}
                            >
                              {deployingFlows[`${flow.id}-source`]
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <ArrowRightCircle className="h-4 w-4" />}
                            </Button>
                          )}
                          {/* Deploy to Destination */}
                          {flow.dest_template_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Deploy to Destination"
                              className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                              disabled={!!deployingFlows[`${flow.id}-destination`]}
                              onClick={() => quickDeploy(flow, 'destination')}
                            >
                              {deployingFlows[`${flow.id}-destination`]
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <ArrowLeftCircle className="h-4 w-4" />}
                            </Button>
                          )}
                          {/* View */}
                          <Button
                            size="sm"
                            variant="outline"
                            title="View"
                            className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => handleView(flow)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Edit */}
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Edit"
                              className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => handleEdit(flow)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Copy */}
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Copy"
                              className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              disabled={copyFlow.isPending}
                              onClick={() => copyFlow.mutate(flow.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Delete */}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Delete"
                              className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setDeleteFlowId(flow.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-6 py-3 text-sm text-slate-500">
            <span>
              Showing {filteredFlows.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredFlows.length)} of{' '}
              {filteredFlows.length} flow{filteredFlows.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <span className="px-2 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Flow create/edit dialog */}
      <FlowDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        flow={editingFlow}
        viewOnly={viewOnly}
        hierarchy={hierarchy}
        registryFlows={registryFlows}
        onSubmit={handleDialogSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Save view dialog */}
      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        existingName={savingViewId ? (activeView?.name ?? '') : undefined}
        existingDescription={savingViewId ? activeView?.description : undefined}
        existingIsDefault={savingViewId ? activeView?.is_default : false}
        onSave={handleSaveView}
        isSaving={isSavingView}
      />

      {/* Quick deploy conflict resolution */}
      <ConflictResolutionDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflictInfo={currentConflict?.conflictInfo ?? null}
        deploymentConfig={currentConflict?.config ?? null}
        onSkip={handleSkipConflict}
        onDelete={handleDeleteConflict}
        onUpdateVersion={handleUpdateConflict}
        isResolving={isResolvingConflict}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteFlowId !== null}
        onOpenChange={open => !open && setDeleteFlowId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flow</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The flow will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
