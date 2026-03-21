import { Button } from '@/components/ui/button'
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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Copy,
  Trash2,
  Workflow,
  ArrowRightCircle,
  ArrowLeftCircle,
  Loader2,
} from 'lucide-react'
import type { NifiFlow, FlowColumn, RegistryFlow } from '../types'
import type { HierarchyAttribute } from '@/components/features/settings/nifi/types'
import { getFlowCellValue } from '../utils/flow-cell-utils'

const ITEMS_PER_PAGE = 10

interface FlowTableProps {
  paginatedFlows: NifiFlow[]
  displayedColumns: FlowColumn[]
  filteredFlowCount: number
  currentPage: number
  totalPages: number
  hierarchy: HierarchyAttribute[]
  registryFlows: RegistryFlow[]
  canWrite: boolean
  canDelete: boolean
  deployingFlows: Record<string, boolean>
  fetchingLinks: Record<string, boolean>
  copyFlowPending: boolean
  onQuickDeploy: (flow: NifiFlow, target: 'source' | 'destination') => void
  onOpenLink: (flow: NifiFlow, target: 'source' | 'destination') => void
  onEdit: (flow: NifiFlow) => void
  onCopy: (flowId: number) => void
  onDelete: (flowId: number) => void
  onPageChange: (page: number) => void
}

export function FlowTable({
  paginatedFlows,
  displayedColumns,
  filteredFlowCount,
  currentPage,
  totalPages,
  hierarchy,
  registryFlows,
  canWrite,
  canDelete,
  deployingFlows,
  fetchingLinks,
  copyFlowPending,
  onQuickDeploy,
  onOpenLink,
  onEdit,
  onCopy,
  onDelete,
  onPageChange,
}: FlowTableProps) {
  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Workflow className="h-4 w-4" />
          <span className="text-sm font-medium">Flows</span>
        </div>
        <div className="text-xs text-blue-100">
          {filteredFlowCount} flow{filteredFlowCount !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-16 font-bold text-slate-600 uppercase text-xs tracking-wide">
                ID
              </TableHead>
              {displayedColumns.map(col => (
                <TableHead
                  key={col.key}
                  className="min-w-[120px] font-bold text-slate-600 uppercase text-xs tracking-wide"
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="text-right font-bold text-slate-600 uppercase text-xs tracking-wide">
                Actions
              </TableHead>
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
                <FlowTableRow
                  key={flow.id}
                  flow={flow}
                  displayedColumns={displayedColumns}
                  hierarchy={hierarchy}
                  registryFlows={registryFlows}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  deployingFlows={deployingFlows}
                  fetchingLinks={fetchingLinks}
                  copyFlowPending={copyFlowPending}
                  onQuickDeploy={onQuickDeploy}
                  onOpenLink={onOpenLink}
                  onEdit={onEdit}
                  onCopy={onCopy}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t px-6 py-3 text-sm text-slate-500">
        <span>
          Showing{' '}
          {filteredFlowCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * ITEMS_PER_PAGE, filteredFlowCount)} of {filteredFlowCount} flow
          {filteredFlowCount !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
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
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface FlowTableRowProps {
  flow: NifiFlow
  displayedColumns: FlowColumn[]
  hierarchy: HierarchyAttribute[]
  registryFlows: RegistryFlow[]
  canWrite: boolean
  canDelete: boolean
  deployingFlows: Record<string, boolean>
  fetchingLinks: Record<string, boolean>
  copyFlowPending: boolean
  onQuickDeploy: (flow: NifiFlow, target: 'source' | 'destination') => void
  onOpenLink: (flow: NifiFlow, target: 'source' | 'destination') => void
  onEdit: (flow: NifiFlow) => void
  onCopy: (flowId: number) => void
  onDelete: (flowId: number) => void
}

function FlowTableRow({
  flow,
  displayedColumns,
  hierarchy,
  registryFlows,
  canWrite,
  canDelete,
  deployingFlows,
  fetchingLinks,
  copyFlowPending,
  onQuickDeploy,
  onOpenLink,
  onEdit,
  onCopy,
  onDelete,
}: FlowTableRowProps) {
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="text-slate-500 text-sm">{flow.id}</TableCell>

      {displayedColumns.map(col => {
        const value = getFlowCellValue(flow, col.key, hierarchy, registryFlows)
        return (
          <TableCell key={col.key} className="max-w-[200px] truncate">
            {col.key === 'active' ? (
              <Badge
                className={
                  value
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-red-100 text-red-800 border-red-300'
                }
              >
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
          {flow.src_template_id && (
            <Button
              size="sm" variant="outline" title="Deploy to Source"
              className="h-8 w-8 p-0 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
              disabled={!!deployingFlows[`${flow.id}-source`]}
              onClick={() => onQuickDeploy(flow, 'source')}
            >
              {deployingFlows[`${flow.id}-source`]
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ArrowRightCircle className="h-4 w-4" />}
            </Button>
          )}
          {flow.dest_template_id && (
            <Button
              size="sm" variant="outline" title="Deploy to Destination"
              className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
              disabled={!!deployingFlows[`${flow.id}-destination`]}
              onClick={() => onQuickDeploy(flow, 'destination')}
            >
              {deployingFlows[`${flow.id}-destination`]
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ArrowLeftCircle className="h-4 w-4" />}
            </Button>
          )}
          {flow.src_template_id && (
            <Button
              size="sm" variant="outline" title="Open Source in NiFi"
              className="h-8 w-8 p-0 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
              disabled={!!fetchingLinks[`${flow.id}-source`]}
              onClick={() => onOpenLink(flow, 'source')}
            >
              {fetchingLinks[`${flow.id}-source`]
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ExternalLink className="h-4 w-4" />}
            </Button>
          )}
          {flow.dest_template_id && (
            <Button
              size="sm" variant="outline" title="Open Destination in NiFi"
              className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
              disabled={!!fetchingLinks[`${flow.id}-destination`]}
              onClick={() => onOpenLink(flow, 'destination')}
            >
              {fetchingLinks[`${flow.id}-destination`]
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ExternalLink className="h-4 w-4" />}
            </Button>
          )}
          {canWrite && (
            <Button
              size="sm" variant="outline" title="Edit"
              className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              onClick={() => onEdit(flow)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canWrite && (
            <Button
              size="sm" variant="outline" title="Copy"
              className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              disabled={copyFlowPending}
              onClick={() => onCopy(flow.id)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm" variant="outline" title="Delete"
              className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => onDelete(flow.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
