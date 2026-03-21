import { useState, useMemo, useCallback } from 'react'
import { useFlowViewsMutations } from './use-flow-views-mutations'
import type { FlowView, FlowColumn } from '../types'

interface UseFlowViewManagementOptions {
  flowViews: FlowView[]
  allColumns: FlowColumn[]
  visibleColumnKeys: string[]
  activeViewId: number | null
  setVisibleColumnKeys: (keys: string[]) => void
  setActiveViewId: (id: number | null) => void
  setFilters: (filters: Record<string, string>) => void
}

export function useFlowViewManagement({
  flowViews,
  allColumns,
  visibleColumnKeys,
  activeViewId,
  setVisibleColumnKeys,
  setActiveViewId,
  setFilters,
}: UseFlowViewManagementOptions) {
  const { createView, updateView, deleteView, setDefaultView } = useFlowViewsMutations()

  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [savingViewId, setSavingViewId] = useState<number | null>(null)

  const activeView = useMemo(
    () => flowViews.find(v => v.id === activeViewId) ?? null,
    [flowViews, activeViewId],
  )

  const handleLoadView = useCallback(
    (view: FlowView) => {
      setVisibleColumnKeys(view.visible_columns)
      setActiveViewId(view.id)
      setFilters({})
    },
    [setVisibleColumnKeys, setActiveViewId, setFilters],
  )

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
          { onSuccess: () => { setSaveViewOpen(false); setActiveViewId(savingViewId) } },
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
    [createView, updateView, savingViewId, visibleColumnKeys, setActiveViewId],
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
    [deleteView, activeViewId, allColumns, setActiveViewId, setVisibleColumnKeys],
  )

  const handleSetDefaultView = useCallback(
    (id: number) => {
      setDefaultView.mutate(id)
    },
    [setDefaultView],
  )

  return useMemo(
    () => ({
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
    }),
    [
      saveViewOpen,
      savingViewId,
      activeView,
      createView,
      updateView,
      handleLoadView,
      handleOpenSaveView,
      handleSaveView,
      handleDeleteView,
      handleSetDefaultView,
    ],
  )
}
