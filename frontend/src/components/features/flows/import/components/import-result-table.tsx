'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { FlowImportResponse, FlowImportResultItem } from '../types'

const STATUS_BADGE: Record<FlowImportResultItem['status'], string> = {
  created: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  skipped: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function ResultRow({ item }: { item: FlowImportResultItem }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow>
        <TableCell className="w-12 text-muted-foreground text-xs">{item.row_index}</TableCell>
        <TableCell className="w-24">
          <Badge
            className={cn(
              'text-xs font-medium capitalize border-0',
              STATUS_BADGE[item.status],
            )}
          >
            {item.status}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">{item.message}</TableCell>
        <TableCell className="w-10">
          {item.flow_data && (
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle details"
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </TableCell>
      </TableRow>
      {open && item.flow_data && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-0">
            <pre className="text-xs p-3 overflow-x-auto">
              {JSON.stringify(item.flow_data, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

interface ImportResultTableProps {
  result: FlowImportResponse
}

export function ImportResultTable({ result }: ImportResultTableProps) {
  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium">
          {result.dry_run ? 'Dry Run Results' : 'Import Results'}
        </span>
        <Badge variant="outline" className="text-xs">
          Total: {result.total}
        </Badge>
        <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
          Created: {result.created}
        </Badge>
        <Badge className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
          Skipped: {result.skipped}
        </Badge>
        {result.errors > 0 && (
          <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">
            Errors: {result.errors}
          </Badge>
        )}
      </div>

      {/* Per-row table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.results.map((item) => (
              <ResultRow key={item.row_index} item={item} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
