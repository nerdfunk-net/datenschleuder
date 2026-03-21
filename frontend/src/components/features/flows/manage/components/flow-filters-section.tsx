import { Input } from '@/components/ui/input'
import { Filter } from 'lucide-react'
import type { FlowColumn } from '../types'

interface FlowFiltersSectionProps {
  displayedColumns: FlowColumn[]
  filters: Record<string, string>
  hasActiveFilters: boolean
  onFilterChange: (key: string, value: string) => void
  onClearFilters: () => void
}

export function FlowFiltersSection({
  displayedColumns,
  filters,
  hasActiveFilters,
  onFilterChange,
  onClearFilters,
}: FlowFiltersSectionProps) {
  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            className="text-xs text-blue-100 hover:text-white transition-colors"
            onClick={onClearFilters}
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
                onChange={e => onFilterChange(col.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
