import { useState, useCallback, useMemo } from 'react'
import type { FlowStatus } from '../types'

const EMPTY_STATUS_FILTER: FlowStatus[] = []

interface UseFlowMonitoringFiltersReturn {
  searchFilter: string
  setSearchFilter: (value: string) => void
  statusFilter: FlowStatus[]
  toggleStatusFilter: (status: FlowStatus) => void
  clusterFilter: number | null
  setClusterFilter: (id: number | null) => void
}

export function useFlowMonitoringFilters(): UseFlowMonitoringFiltersReturn {
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<FlowStatus[]>(EMPTY_STATUS_FILTER)
  const [clusterFilter, setClusterFilter] = useState<number | null>(null)

  const toggleStatusFilter = useCallback((status: FlowStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    )
  }, [])

  return useMemo(
    () => ({
      searchFilter,
      setSearchFilter,
      statusFilter,
      toggleStatusFilter,
      clusterFilter,
      setClusterFilter,
    }),
    [searchFilter, statusFilter, toggleStatusFilter, clusterFilter],
  )
}
