'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileText, Server, ClipboardList, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useWizardForm } from '../hooks/use-wizard-form'
import type { WizardTab } from '../hooks/use-wizard-form'
import { useFlowsMutations } from '../hooks/use-flows-mutations'
import { useHierarchyMutations } from '@/components/features/settings/hierarchy/hooks/use-hierarchy-mutations'
import { useParameterContextMutations } from '@/components/features/nifi/parameters/hooks/use-parameter-contexts-mutations'
import { useWizardParameterSuggestions } from '../hooks/use-wizard-parameter-suggestions'
import { WizardGeneralTab } from '../components/wizard-general-tab'
import { WizardConnectionTab } from '../components/wizard-connection-tab'
import { WizardSummaryTab } from '../components/wizard-summary-tab'
import { WizardSaveParametersDialog } from './wizard-save-parameters-dialog'
import type { HierarchyAttribute } from '@/components/features/settings/nifi/types'
import type { ParameterEntity } from '@/components/features/nifi/parameters/types'
import type { ParameterSuggestion, SideSuggestions } from '../hooks/use-wizard-parameter-suggestions'

interface FlowWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hierarchy: HierarchyAttribute[]
}

const TABS: { key: WizardTab; label: string; icon: typeof FileText }[] = [
  { key: 'general', label: 'General', icon: FileText },
  { key: 'source', label: 'Source', icon: Server },
  { key: 'destination', label: 'Destination', icon: Server },
  { key: 'summary', label: 'Summary', icon: ClipboardList },
]

/**
 * Build the full parameter list to send to the PUT endpoint.
 * The NiFi API replaces all parameters, so we merge existing ones with
 * the new suggestions rather than sending only the new values.
 */
function buildMergedParams(
  existing: ParameterEntity[],
  suggestions: ParameterSuggestion[],
): { name: string; description?: string; sensitive: boolean; value?: string }[] {
  const result = existing.map(p => ({
    name: p.name,
    description: p.description,
    sensitive: p.sensitive,
    value: p.value,
  }))

  for (const s of suggestions) {
    const idx = result.findIndex(p => p.name === s.key)
    if (idx >= 0) {
      result[idx]!.value = s.value
    } else {
      result.push({ name: s.key, description: undefined, sensitive: s.sensitive, value: s.value })
    }
  }

  return result
}

export function FlowWizardDialog({ open, onOpenChange, hierarchy }: FlowWizardDialogProps) {
  const wizard = useWizardForm(hierarchy)
  const { createFlow } = useFlowsMutations()
  const { saveValues } = useHierarchyMutations()
  const { updateContext } = useParameterContextMutations()
  const queryClient = useQueryClient()
  const paramSuggestions = useWizardParameterSuggestions(wizard)

  const [isSaving, setIsSaving] = useState(false)
  const [showSaveParamsDialog, setShowSaveParamsDialog] = useState(false)

  const currentTabIndex = TABS.findIndex(t => t.key === wizard.state.currentTab)
  const isFirstTab = currentTabIndex === 0
  const isLastTab = currentTabIndex === TABS.length - 1

  const handleClose = useCallback((openState: boolean) => {
    if (!openState) {
      wizard.reset()
    }
    onOpenChange(openState)
  }, [onOpenChange, wizard])

  // ── Core create logic (shared by both "save" and "skip" paths) ──────────────
  const runCreate = useCallback(async () => {
    // 1. Save new hierarchy values
    const newVals = wizard.state.newHierarchyValues
    for (const [attrName, newValues] of Object.entries(newVals)) {
      if (newValues.length === 0) continue
      const cached = queryClient.getQueryData<{ attribute_name: string; values: string[] }>(
        queryKeys.nifi.hierarchyValues(attrName),
      )
      const existingValues = cached?.values ?? []
      const merged = [...new Set([...existingValues, ...newValues])]
      await saveValues.mutateAsync({ attributeName: attrName, values: merged })
    }

    // 2. Create the flow
    const payload = wizard.buildPayload()
    await createFlow.mutateAsync(payload)

    // 3. Success — close and reset
    wizard.reset()
    onOpenChange(false)
  }, [wizard, createFlow, saveValues, queryClient, onOpenChange])

  // ── "Create Flow" button clicked ────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    if (paramSuggestions.hasSuggestions) {
      setShowSaveParamsDialog(true)
    } else {
      setIsSaving(true)
      runCreate().finally(() => setIsSaving(false))
    }
  }, [paramSuggestions.hasSuggestions, runCreate])

  // ── Update one parameter context then continue ───────────────────────────────
  const updateOneSide = useCallback(async (side: SideSuggestions) => {
    const params = buildMergedParams(side.existingParams, side.suggestions)
    await updateContext.mutateAsync({
      instanceId: side.instanceId,
      contextId: side.contextId,
      parameters: params,
    })
  }, [updateContext])

  // ── "Save & Create Flow" ─────────────────────────────────────────────────────
  const handleSaveAndCreate = useCallback(async () => {
    setIsSaving(true)
    setShowSaveParamsDialog(false)
    try {
      if (paramSuggestions.srcSuggestions) {
        await updateOneSide(paramSuggestions.srcSuggestions)
      }
      if (paramSuggestions.destSuggestions) {
        await updateOneSide(paramSuggestions.destSuggestions)
      }
      await runCreate()
    } catch {
      // Errors are handled by the mutation's onError
    } finally {
      setIsSaving(false)
    }
  }, [paramSuggestions, updateOneSide, runCreate])

  // ── "Skip & Create Flow" ─────────────────────────────────────────────────────
  const handleSkipAndCreate = useCallback(async () => {
    setIsSaving(true)
    setShowSaveParamsDialog(false)
    try {
      await runCreate()
    } catch {
      // Errors are handled by the mutation's onError
    } finally {
      setIsSaving(false)
    }
  }, [runCreate])

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="!max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Flow Creation Wizard</DialogTitle>
            <p className="text-sm text-muted-foreground">Step-by-step flow configuration</p>
          </DialogHeader>

          {/* Tab navigation bar */}
          <div className="flex border-b">
            {TABS.map((tab, idx) => {
              const Icon = tab.icon
              const isActive = wizard.state.currentTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => wizard.setTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {wizard.state.currentTab === 'general' && (
              <WizardGeneralTab wizard={wizard} />
            )}
            {wizard.state.currentTab === 'source' && (
              <WizardConnectionTab side="source" hierarchy={hierarchy} wizard={wizard} />
            )}
            {wizard.state.currentTab === 'destination' && (
              <WizardConnectionTab side="destination" hierarchy={hierarchy} wizard={wizard} />
            )}
            {wizard.state.currentTab === 'summary' && (
              <WizardSummaryTab wizard={wizard} hierarchy={hierarchy} />
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 flex items-center justify-between">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {!isFirstTab && (
                <Button variant="outline" onClick={wizard.goPrev}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
              )}
              {!isLastTab ? (
                <Button onClick={wizard.goNext}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Flow'
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parameter context save confirmation */}
      <WizardSaveParametersDialog
        open={showSaveParamsDialog}
        onOpenChange={setShowSaveParamsDialog}
        srcSuggestions={paramSuggestions.srcSuggestions}
        destSuggestions={paramSuggestions.destSuggestions}
        onSaveAndCreate={handleSaveAndCreate}
        onSkipAndCreate={handleSkipAndCreate}
        isSaving={isSaving}
      />
    </>
  )
}
