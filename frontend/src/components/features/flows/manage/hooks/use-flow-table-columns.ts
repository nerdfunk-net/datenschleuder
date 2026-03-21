import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { FlowColumn, FlowView } from '../types'

interface UseFlowTableColumnsOptions {
  allColumns: FlowColumn[]
  flowViews: FlowView[]
}

export function useFlowTableColumns({ allColumns, flowViews }: UseFlowTableColumnsOptions) {
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([])
  const [activeViewId, setActiveViewId] = useState<number | null>(null)
  const columnsInitialized = useRef(false)
  const [defaultViewApplied, setDefaultViewApplied] = useState(false)

  // Initialize all columns on first load
  useEffect(() => {
    if (!columnsInitialized.current && allColumns.length > 0) {
      columnsInitialized.current = true
      setVisibleColumnKeys(allColumns.map(c => c.key))
    }
  }, [allColumns])

  // Apply default view once columns and views are loaded
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

  return useMemo(
    () => ({
      visibleColumnKeys,
      setVisibleColumnKeys,
      displayedColumns,
      activeViewId,
      setActiveViewId,
      handleToggleColumn,
      handleShowAllColumns,
      handleDeselectAllColumns,
    }),
    [
      visibleColumnKeys,
      displayedColumns,
      activeViewId,
      handleToggleColumn,
      handleShowAllColumns,
      handleDeselectAllColumns,
    ],
  )
}
