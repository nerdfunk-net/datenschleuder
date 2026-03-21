'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
import { Plus, Workflow, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useToast } from '@/hooks/use-toast'
import { useNifiHierarchyQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import { useNifiClustersQuery } from '@/components/features/settings/nifi/hooks/use-nifi-clusters-query'
import { useFlowsQuery, useRegistryFlowsQuery, useFlowColumnsQuery } from './hooks/use-flows-query'
import { useFlowsMutations } from './hooks/use-flows-mutations'
import { useFlowViewsQuery } from './hooks/use-flow-views-query'
import { useFlowTableColumns } from './hooks/use-flow-table-columns'
import { useFlowFiltering } from './hooks/use-flow-filtering'
import { useFlowViewManagement } from './hooks/use-flow-view-management'
import { FlowDialog } from './dialogs/flow-dialog'
import { FlowWizardDialog } from './dialogs/flow-wizard-dialog'
import { SaveViewDialog } from './dialogs/save-view-dialog'
import { ConflictResolutionDialog } from '@/components/features/flows/deploy/dialogs/conflict-resolution-dialog'
import { useQuickDeploy } from '@/components/features/flows/deploy/hooks/use-quick-deploy'
import { FlowTableToolbar } from './components/flow-table-toolbar'
import { FlowFiltersSection } from './components/flow-filters-section'
import { FlowTable } from './components/flow-table'
import { formValuesToPayload } from './utils/flow-cell-utils'
import type { NifiFlow, FlowView, FlowFormValues, RegistryFlow } from './types'
import type { HierarchyAttribute, NifiCluster } from '@/components/features/settings/nifi/types'

const EMPTY_FLOWS: NifiFlow[] = []
const EMPTY_VIEWS: FlowView[] = []
const EMPTY_REGISTRY: RegistryFlow[] = []
const EMPTY_HIERARCHY: HierarchyAttribute[] = []
const EMPTY_CLUSTERS: NifiCluster[] = []

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

export function FlowsManagePage() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi', 'write')
  const canDelete = hasPermission(user, 'nifi', 'delete')
  const { toast } = useToast()

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: flows = EMPTY_FLOWS, isLoading: flowsLoading } = useFlowsQuery()
  const { data: registryFlows = EMPTY_REGISTRY } = useRegistryFlowsQuery()
  const { data: columnsData } = useFlowColumnsQuery()
  const { data: hierarchyData } = useNifiHierarchyQuery()
  const { data: flowViews = EMPTY_VIEWS } = useFlowViewsQuery()
  const { data: clusters = EMPTY_CLUSTERS } = useNifiClustersQuery()

  const allColumns = useMemo(() => columnsData?.columns ?? [], [columnsData])
  const hierarchy: HierarchyAttribute[] = useMemo(
    () => hierarchyData?.hierarchy ?? EMPTY_HIERARCHY,
    [hierarchyData],
  )
  const hierAttrsForDeploy = useMemo(
    () => (hierarchyData?.hierarchy ?? []).map((a: { name: string; label: string }, i: number) => ({
      name: a.name, label: a.label, order: i,
    })),
    [hierarchyData],
  )

  // ── Mutations ──────────────────────────────────────────────────────────────
  const { createFlow, updateFlow, deleteFlow, copyFlow, fetchProcessGroups } = useFlowsMutations()

  // ── Column & filter state ──────────────────────────────────────────────────
  const {
    visibleColumnKeys,
    setVisibleColumnKeys,
    displayedColumns,
    activeViewId,
    setActiveViewId,
    handleToggleColumn,
    handleShowAllColumns,
    handleDeselectAllColumns,
  } = useFlowTableColumns({ allColumns, flowViews })

  const {
    filters,
    setFilters,
    currentPage,
    setCurrentPage,
    filteredFlows,
    paginatedFlows,
    totalPages,
    hasActiveFilters,
    handleFilterChange,
  } = useFlowFiltering({ flows, displayedColumns, hierarchy, registryFlows })

  // ── Views ──────────────────────────────────────────────────────────────────
  const {
    saveViewOpen,
    setSaveViewOpen,
    savingViewId,
    activeView,
    createView,
    updateView,
    handleLoadView,
    handleOpenSaveView,
    handleSaveView,
    handleDeleteView,
    handleSetDefaultView,
  } = useFlowViewManagement({
    flowViews,
    allColumns,
    visibleColumnKeys,
    activeViewId,
    setVisibleColumnKeys,
    setActiveViewId,
    setFilters,
  })

  // ── Flow dialogs ───────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<NifiFlow | null>(null)
  const [viewOnly] = useState(false)

  const handleAdd = useCallback(() => {
    setEditingFlow(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((flow: NifiFlow) => {
    setEditingFlow(flow)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingFlow(null)
  }, [])

  const handleDialogSubmit = useCallback((values: FlowFormValues, id?: number) => {
    const payload = formValuesToPayload(values)
    if (id) {
      updateFlow.mutate({ id, data: payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createFlow.mutate(payload, { onSuccess: () => setDialogOpen(false) })
    }
  }, [createFlow, updateFlow])

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteFlowId, setDeleteFlowId] = useState<number | null>(null)

  const handleDeleteConfirm = useCallback(() => {
    if (deleteFlowId !== null) {
      deleteFlow.mutate(deleteFlowId, { onSuccess: () => setDeleteFlowId(null) })
    }
  }, [deleteFlow, deleteFlowId])

  // ── NiFi links ─────────────────────────────────────────────────────────────
  const [fetchingLinks, setFetchingLinks] = useState<Record<string, boolean>>({})

  const handleOpenLink = useCallback(async (flow: NifiFlow, target: 'source' | 'destination') => {
    const key = `${flow.id}-${target}`
    setFetchingLinks(prev => ({ ...prev, [key]: true }))
    try {
      const result = await fetchProcessGroups.mutateAsync(flow.id)
      const pg = target === 'source' ? result.source : result.destination
      if (pg?.nifi_link) {
        window.open(pg.nifi_link, '_blank', 'noopener,noreferrer')
      } else {
        toast({ title: 'Process group not found', description: 'Make sure the flow has been deployed.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to get process group information.', variant: 'destructive' })
    } finally {
      setFetchingLinks(prev => ({ ...prev, [key]: false }))
    }
  }, [fetchProcessGroups, toast])

  // ── Quick deploy ───────────────────────────────────────────────────────────
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
  } = useQuickDeploy({ clusters, registryFlows, hierarchyAttributes: hierAttrsForDeploy })

  // ── Render ─────────────────────────────────────────────────────────────────
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

  const toolbar = (
    <FlowTableToolbar
      allColumns={allColumns}
      visibleColumnKeys={visibleColumnKeys}
      activeView={activeView}
      flowViews={flowViews}
      activeViewId={activeViewId}
      canWrite={canWrite}
      canDelete={canDelete}
      onToggleColumn={handleToggleColumn}
      onShowAllColumns={handleShowAllColumns}
      onDeselectAllColumns={handleDeselectAllColumns}
      onLoadView={handleLoadView}
      onOpenSaveView={handleOpenSaveView}
      onDeleteView={handleDeleteView}
      onSetDefaultView={handleSetDefaultView}
      onWizardOpen={() => setWizardOpen(true)}
      onAdd={handleAdd}
    />
  )

  return (
    <div className="space-y-6">
      <PageHeader>{toolbar}</PageHeader>

      {flows.length > 0 && displayedColumns.length > 0 && (
        <FlowFiltersSection
          displayedColumns={displayedColumns}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={() => setFilters({})}
        />
      )}

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

      {flows.length > 0 && (
        <FlowTable
          paginatedFlows={paginatedFlows}
          displayedColumns={displayedColumns}
          filteredFlowCount={filteredFlows.length}
          currentPage={currentPage}
          totalPages={totalPages}
          hierarchy={hierarchy}
          registryFlows={registryFlows}
          canWrite={canWrite}
          canDelete={canDelete}
          deployingFlows={deployingFlows}
          fetchingLinks={fetchingLinks}
          copyFlowPending={copyFlow.isPending}
          onQuickDeploy={quickDeploy}
          onOpenLink={handleOpenLink}
          onEdit={handleEdit}
          onCopy={(id) => copyFlow.mutate(id)}
          onDelete={setDeleteFlowId}
          onPageChange={setCurrentPage}
        />
      )}

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

      <FlowWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        hierarchy={hierarchy}
      />

      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        existingName={savingViewId ? (activeView?.name ?? '') : undefined}
        existingDescription={savingViewId ? activeView?.description : undefined}
        existingIsDefault={savingViewId ? activeView?.is_default : false}
        onSave={handleSaveView}
        isSaving={isSavingView}
      />

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
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
