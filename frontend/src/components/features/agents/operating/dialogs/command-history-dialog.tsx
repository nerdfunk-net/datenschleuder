'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { History } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAgentHistoryQuery } from '../hooks/use-agent-history-query'
import { formatExecutionTime } from '../utils/format-utils'
import { EMPTY_HISTORY } from '../utils/constants'

interface CommandHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
}

function statusVariant(status: string | null): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (status) {
    case 'success':
      return 'default'
    case 'error':
      return 'destructive'
    case 'timeout':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function CommandHistoryDialog({ open, onOpenChange, agentId }: CommandHistoryDialogProps) {
  const { data, isLoading } = useAgentHistoryQuery(agentId, { enabled: open && !!agentId })
  const commands = data?.commands ?? EMPTY_HISTORY

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Command History — {agentId}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
            </div>
          ) : commands.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No commands recorded</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent By</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.map((cmd) => (
                  <TableRow key={cmd.id}>
                    <TableCell className="font-mono text-xs">{cmd.command}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(cmd.status)} className="text-xs">
                        {cmd.status ?? 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{cmd.sent_by ?? '-'}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(cmd.sent_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatExecutionTime(cmd.execution_time_ms)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
