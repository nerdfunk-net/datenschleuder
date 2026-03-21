import { useState, useMemo, useCallback, useEffect } from 'react'
import type { NifiFlow, FlowColumn, RegistryFlow } from '../types'
import type { HierarchyAttribute } from '@/components/features/settings/nifi/types'
import { getFlowCellValue } from '../utils/flow-cell-utils'

const ITEMS_PER_PAGE = 10

interface UseFlowFilteringOptions {
  flows: NifiFlow[]
  displayedColumns: FlowColumn[]
  hierarchy: HierarchyAttribute[]
  registryFlows: RegistryFlow[]
}

export function useFlowFiltering({
  flows,
  displayedColumns,
  hierarchy,
  registryFlows,
}: UseFlowFilteringOptions) {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  const filteredFlows = useMemo(
    () =>
      flows.filter(flow =>
        displayedColumns.every(col => {
          const filter = filters[col.key]
          if (!filter) return true
          const value = getFlowCellValue(flow, col.key, hierarchy, registryFlows)
          return String(value).toLowerCase().includes(filter.toLowerCase())
        }),
      ),
    [flows, displayedColumns, filters, hierarchy, registryFlows],
  )

  const totalPages = Math.max(1, Math.ceil(filteredFlows.length / ITEMS_PER_PAGE))

  const paginatedFlows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredFlows.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredFlows, currentPage])

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return useMemo(
    () => ({
      filters,
      setFilters,
      currentPage,
      setCurrentPage,
      filteredFlows,
      paginatedFlows,
      totalPages,
      hasActiveFilters,
      handleFilterChange,
    }),
    [
      filters,
      currentPage,
      filteredFlows,
      paginatedFlows,
      totalPages,
      hasActiveFilters,
      handleFilterChange,
    ],
  )
}
