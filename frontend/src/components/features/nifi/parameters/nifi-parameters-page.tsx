'use client'

import { useState, useCallback, useMemo } from 'react'
import { Settings2, Plus, Search, Pencil, Copy, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import { useParameterContextsListQuery } from './hooks/use-parameter-contexts-query'
import { useParameterContextMutations } from './hooks/use-parameter-contexts-mutations'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { ParameterContextDialog } from './components/parameter-context-dialog'
import { BoundProcessGroupsDialog } from './components/bound-process-groups-dialog'
import { DeleteErrorDialog } from './components/delete-error-dialog'
import type { NifiInstance } from '@/components/features/settings/nifi/types'
import type {
  ParameterContext,
  ParameterContextForm,
  FormParameter,
  ModalMode,
  ParameterContextDetailResponse,
} from './types'

// Stable empty defaults
const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_CONTEXTS: ParameterContext[] = []

const EMPTY_FORM: ParameterContextForm = {
  instance_id: null,
  context_id: null,
  name: '',
  description: '',
  parameters: [],
  inherited_parameter_contexts: [],
}

// ============================================================================
// Helper: build combined parameters list with inheritance info
// ============================================================================

function buildCombinedParameters(
  localParams: ParameterContext['parameters'],
  inheritedMap: Map<string, { value: string; description: string; sensitive: boolean; contextName: string }>,
): FormParameter[] {
  const combined: FormParameter[] = []
  const processedKeys = new Set<string>()

  for (const param of localParams) {
    const inherited = inheritedMap.get(param.name)
    combined.push({
      ...param,
      _key: `local-${param.name}`,
      value: param.value ?? '',
      description: param.description ?? '',
      isExisting: true,
      isLocal: true,
      inheritedFrom: inherited ? inherited.contextName : null,
      isOverridden: !!inherited,
    })
    processedKeys.add(param.name)
  }

  for (const [key, inherited] of inheritedMap.entries()) {
    if (!processedKeys.has(key)) {
      combined.push({
        name: key,
        value: inherited.value,
        description: inherited.description,
        sensitive: inherited.sensitive,
        _key: `inherited-${key}`,
        isExisting: true,
        isLocal: false,
        inheritedFrom: inherited.contextName,
        isOverridden: false,
      })
    }
  }

  return combined
}

// ============================================================================
// InstanceSection — loads and shows contexts for one NiFi instance
// ============================================================================

interface InstanceSectionProps {
  instance: NifiInstance
  searchQuery: string
  onEdit: (instanceId: number, context: ParameterContext) => void
  onCopy: (instanceId: number, context: ParameterContext) => void
  onDelete: (instanceId: number, context: ParameterContext) => void
  onViewBound: (context: ParameterContext) => void
}

function InstanceSection({
  instance,
  searchQuery,
  onEdit,
  onCopy,
  onDelete,
  onViewBound,
}: InstanceSectionProps) {
  const { data, isLoading } = useParameterContextsListQuery(instance.id)
  const contexts = data?.parameter_contexts ?? EMPTY_CONTEXTS

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contexts
    const q = searchQuery.toLowerCase()
    return contexts.filter((c) => c.name?.toLowerCase().includes(q))
  }, [contexts, searchQuery])

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Section gradient header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Settings2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            {instance.hierarchy_attribute}={instance.hierarchy_value}
          </span>
        </div>
        <span className="text-xs text-blue-100">{instance.nifi_url}</span>
      </div>

      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-600">Loading parameter contexts...</span>
          </div>
        ) : filtered.length === 0 ? (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              {searchQuery.trim()
                ? 'No parameter contexts match your search.'
                : 'No parameter contexts found for this instance.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] bg-gray-50 border-b border-gray-200 px-4 py-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</span>
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</span>
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Parameters</span>
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bound</span>
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide text-right">Actions</span>
            </div>

            {filtered.map((ctx) => (
              <div
                key={ctx.id}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] px-4 py-3 border-b border-gray-100 last:border-0 items-center hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-sm text-gray-900">{ctx.name}</span>
                <span className="text-sm text-gray-500 truncate pr-4">
                  {ctx.description || <span className="italic">No description</span>}
                </span>
                <span className="text-sm text-gray-700">{ctx.parameters?.length ?? 0} parameters</span>
                <div>
                  {!ctx.bound_process_groups || ctx.bound_process_groups.length === 0 ? (
                    <span className="text-sm text-gray-400">0</span>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={() => onViewBound(ctx)}
                    >
                      {ctx.bound_process_groups.length}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    title="Edit"
                    onClick={() => onEdit(instance.id, ctx)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    title="Copy"
                    onClick={() => onCopy(instance.id, ctx)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-red-500 hover:text-red-700 hover:border-red-300"
                    title="Delete"
                    onClick={() => onDelete(instance.id, ctx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// NifiParametersPage — top-level page component
// ============================================================================

export function NifiParametersPage() {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const { data: instancesData, isLoading: isLoadingInstances } = useNifiInstancesQuery()
  const instances = instancesData ?? EMPTY_INSTANCES

  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [form, setForm] = useState<ParameterContextForm>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [allContextsForInstance, setAllContextsForInstance] = useState<ParameterContext[]>(
    EMPTY_CONTEXTS,
  )

  const [boundOpen, setBoundOpen] = useState(false)
  const [boundContext, setBoundContext] = useState<ParameterContext | null>(null)

  const [deleteErrorOpen, setDeleteErrorOpen] = useState(false)
  const [deleteErrorContext, setDeleteErrorContext] = useState<ParameterContext | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('')

  const { createContext, updateContext, deleteContext } = useParameterContextMutations()

  // ---- Helpers ----

  const openCreate = useCallback(() => {
    const defaultInstanceId = instances.length > 0 ? (instances[0]?.id ?? null) : null
    setForm({ ...EMPTY_FORM, instance_id: defaultInstanceId })
    setModalMode('create')
    setAllContextsForInstance(EMPTY_CONTEXTS)
    setModalOpen(true)
  }, [instances])

  const openEdit = useCallback(
    async (instanceId: number, context: ParameterContext) => {
      setIsSaving(false)
      setModalMode('edit')

      try {
        // Fetch full detail (including parameters & inheritance)
        const detail = await apiCall<ParameterContextDetailResponse>(
          `nifi/instances/${instanceId}/ops/parameter-contexts/${context.id}`,
        )
        const ctx = detail?.parameter_context ?? context

        // Fetch all contexts for inheritance management
        const listResponse = await apiCall<{ parameter_contexts: ParameterContext[] }>(
          `nifi/instances/${instanceId}/ops/parameters`,
        )
        const allContexts = listResponse?.parameter_contexts ?? EMPTY_CONTEXTS
        setAllContextsForInstance(allContexts)

        // Build inherited params map
        const inheritedIds = ctx.inherited_parameter_contexts ?? []
        const inheritedMap = new Map<
          string,
          { value: string; description: string; sensitive: boolean; contextName: string }
        >()

        for (const id of inheritedIds) {
          try {
            const r = await apiCall<ParameterContextDetailResponse>(
              `nifi/instances/${instanceId}/ops/parameter-contexts/${id}`,
            )
            const ic = r?.parameter_context
            if (ic?.parameters) {
              for (const p of ic.parameters) {
                inheritedMap.set(p.name, {
                  value: p.value ?? '',
                  description: p.description ?? '',
                  sensitive: p.sensitive,
                  contextName: ic.name,
                })
              }
            }
          } catch {
            // Skip failed inherited context fetches
          }
        }

        const combinedParams = buildCombinedParameters(ctx.parameters ?? [], inheritedMap)

        setForm({
          instance_id: instanceId,
          context_id: ctx.id,
          name: ctx.name,
          description: ctx.description ?? '',
          parameters: combinedParams,
          inherited_parameter_contexts: inheritedIds,
        })
        setModalOpen(true)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load parameter context'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      }
    },
    [apiCall, toast],
  )

  const openCopy = useCallback((instanceId: number, context: ParameterContext) => {
    setModalMode('create')
    setAllContextsForInstance(EMPTY_CONTEXTS)
    setForm({
      instance_id: instanceId,
      context_id: null,
      name: `copy_of_${context.name}`,
      description: context.description ?? '',
      parameters: (context.parameters ?? []).map((p) => ({
        ...p,
        _key: `copy-${p.name}`,
        value: p.value ?? '',
        description: p.description ?? '',
        isExisting: false,
        isLocal: true,
        inheritedFrom: null,
        isOverridden: false,
      })),
      inherited_parameter_contexts: [],
    })
    setModalOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (instanceId: number, context: ParameterContext) => {
      if (!confirm(`Delete parameter context "${context.name}"?`)) return
      try {
        await deleteContext.mutateAsync({ instanceId, contextId: context.id })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete parameter context'
        const isBound =
          message.toLowerCase().includes('bound') ||
          message.toLowerCase().includes('referenced') ||
          (err instanceof Error && 'status' in err && (err as { status?: number }).status === 409)

        if (isBound) {
          setDeleteErrorContext(context)
          setDeleteErrorMessage(message)
          setDeleteErrorOpen(true)
        } else {
          toast({ title: 'Error', description: message, variant: 'destructive' })
        }
      }
    },
    [deleteContext, toast],
  )

  const handleSave = useCallback(async () => {
    if (!form.name) {
      toast({ title: 'Validation', description: 'Please enter a name', variant: 'destructive' })
      return
    }
    if (modalMode === 'create' && !form.instance_id) {
      toast({ title: 'Validation', description: 'Please select a NiFi instance', variant: 'destructive' })
      return
    }

    const params = form.parameters
      .filter((p) => p.name && p.isLocal)
      .map((p) => ({
        name: p.name,
        description: p.description || undefined,
        sensitive: p.sensitive,
        value: p.value || undefined,
      }))

    setIsSaving(true)
    try {
      if (modalMode === 'create') {
        await createContext.mutateAsync({
          instanceId: form.instance_id!,
          name: form.name,
          description: form.description || undefined,
          parameters: params,
        })
      } else {
        await updateContext.mutateAsync({
          instanceId: form.instance_id!,
          contextId: form.context_id!,
          name: form.name,
          description: form.description || undefined,
          parameters: params,
          inherited_parameter_contexts: form.inherited_parameter_contexts,
        })
      }
      setModalOpen(false)
    } catch {
      // Errors are handled in mutation hooks
    } finally {
      setIsSaving(false)
    }
  }, [form, modalMode, createContext, updateContext, toast])

  const handleViewBound = useCallback((context: ParameterContext) => {
    setBoundContext(context)
    setBoundOpen(true)
  }, [])

  // ---- Render loading state ----

  if (isLoadingInstances) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Settings2 className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Parameter Contexts</h1>
            <p className="text-muted-foreground mt-2">Manage NiFi parameter contexts</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Settings2 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Parameter Contexts</h1>
              <p className="text-muted-foreground mt-2">Manage NiFi parameter contexts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name..."
                className="pl-8 w-64"
              />
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Parameter Context
            </Button>
          </div>
        </div>

        {/* No instances warning */}
        {instances.length === 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              No NiFi instances configured. Please configure a NiFi instance first.
            </AlertDescription>
          </Alert>
        )}

        {/* One section per NiFi instance */}
        {instances.map((instance) => (
          <InstanceSection
            key={instance.id}
            instance={instance}
            searchQuery={searchQuery}
            onEdit={openEdit}
            onCopy={openCopy}
            onDelete={handleDelete}
            onViewBound={handleViewBound}
          />
        ))}
      </div>

      {/* Create / Edit dialog */}
      <ParameterContextDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        form={form}
        onFormChange={setForm}
        instances={instances}
        allContextsForInstance={allContextsForInstance}
        isSaving={isSaving}
        onSave={handleSave}
      />

      {/* Bound process groups dialog */}
      <BoundProcessGroupsDialog
        open={boundOpen}
        onOpenChange={setBoundOpen}
        context={boundContext}
      />

      {/* Delete error dialog */}
      <DeleteErrorDialog
        open={deleteErrorOpen}
        onOpenChange={setDeleteErrorOpen}
        context={deleteErrorContext}
        errorMessage={deleteErrorMessage}
        onViewBoundGroups={() => {
          if (deleteErrorContext) handleViewBound(deleteErrorContext)
        }}
      />
    </>
  )
}
