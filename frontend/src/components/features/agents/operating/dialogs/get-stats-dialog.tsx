'use client'

import { useState } from 'react'
import { UseMutationResult } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, ChevronDown, Terminal, BarChart2, Server } from 'lucide-react'
import type { CommandResult, DockerPsRow, DockerStatsRow } from '../types'

interface GetStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  sendCommand: UseMutationResult<
    CommandResult,
    Error,
    { agent_id: string; command: string; params?: Record<string, unknown> }
  >
}

type LastCommand = 'docker_ps' | 'docker_stats' | null

const COMMAND_LABELS: Record<NonNullable<LastCommand>, string> = {
  docker_ps: 'Running Containers',
  docker_stats: 'Docker Stats',
}

function isDockerPsRows(rows: DockerPsRow[] | DockerStatsRow[]): rows is DockerPsRow[] {
  return rows.length === 0 || ('names' in (rows[0] as DockerPsRow))
}

export function GetStatsDialog({ open, onOpenChange, agentId, sendCommand }: GetStatsDialogProps) {
  const [lastCommand, setLastCommand] = useState<LastCommand>(null)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [rawOpen, setRawOpen] = useState(false)

  const run = async (command: 'docker_ps' | 'docker_stats') => {
    setLastCommand(command)
    setResult(null)
    setRawOpen(false)
    try {
      const data = await sendCommand.mutateAsync({ agent_id: agentId, command })
      setResult(data)
    } catch {
      // error toast handled by the mutation's onError
    }
  }

  const parsedRows = result?.parsed_output ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-[80vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Server className="h-5 w-5 text-blue-600" />
            Agent Stats — <span className="font-mono text-blue-600">{agentId}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Panel 1: Run Command */}
          <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg">
              <Terminal className="h-4 w-4" />
              <span className="text-sm font-medium">Run Command</span>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sendCommand.isPending}
                  onClick={() => run('docker_ps')}
                  className={lastCommand === 'docker_ps' && result ? 'border-blue-400 text-blue-700' : ''}
                >
                  {sendCommand.isPending && lastCommand === 'docker_ps' ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Server className="h-3 w-3 mr-1.5" />
                  )}
                  Running Containers
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sendCommand.isPending}
                  onClick={() => run('docker_stats')}
                  className={lastCommand === 'docker_stats' && result ? 'border-blue-400 text-blue-700' : ''}
                >
                  {sendCommand.isPending && lastCommand === 'docker_stats' ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <BarChart2 className="h-3 w-3 mr-1.5" />
                  )}
                  Docker Stats
                </Button>
              </div>
            </div>
          </div>

          {/* Panel 2: View Response */}
          <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                <span className="text-sm font-medium">View Response</span>
              </div>
              {lastCommand && (
                <span className="text-xs text-blue-100">
                  {COMMAND_LABELS[lastCommand]}
                </span>
              )}
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
              {/* Loading state */}
              {sendCommand.isPending && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Running {lastCommand ? COMMAND_LABELS[lastCommand] : 'command'}…
                  </span>
                </div>
              )}

              {/* Empty state */}
              {!sendCommand.isPending && !result && (
                <div className="text-center py-8 text-gray-400">
                  <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No results yet</p>
                  <p className="text-xs mt-1">Select a command above to fetch data</p>
                </div>
              )}

              {/* Results */}
              {!sendCommand.isPending && result && (
                <div className="space-y-3">
                  {/* Parsed table */}
                  {parsedRows && parsedRows.length > 0 ? (
                    <div className="border rounded-md overflow-auto">
                      {lastCommand === 'docker_ps' && isDockerPsRows(parsedRows) ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-xs font-semibold">Name</TableHead>
                              <TableHead className="text-xs font-semibold">Image</TableHead>
                              <TableHead className="text-xs font-semibold">Status</TableHead>
                              <TableHead className="text-xs font-semibold">Ports</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(parsedRows as DockerPsRow[]).map((row) => (
                              <TableRow key={row.container_id || row.names}>
                                <TableCell className="font-mono text-xs font-medium">{row.names}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{row.image}</TableCell>
                                <TableCell className="text-xs">{row.status}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {row.ports || '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-xs font-semibold">Name</TableHead>
                              <TableHead className="text-xs font-semibold">CPU %</TableHead>
                              <TableHead className="text-xs font-semibold">Memory</TableHead>
                              <TableHead className="text-xs font-semibold">Net I/O</TableHead>
                              <TableHead className="text-xs font-semibold">Block I/O</TableHead>
                              <TableHead className="text-xs font-semibold">PIDs</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(parsedRows as DockerStatsRow[]).map((row) => (
                              <TableRow key={row.container_id || row.name}>
                                <TableCell className="font-mono text-xs font-medium">{row.name}</TableCell>
                                <TableCell className="text-xs">{row.cpu_percent}</TableCell>
                                <TableCell className="text-xs">
                                  {row.mem_usage} / {row.mem_limit}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {row.net_io_rx} / {row.net_io_tx}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {row.block_io_read} / {row.block_io_write}
                                </TableCell>
                                <TableCell className="text-xs">{row.pids}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No data returned.</p>
                  )}

                  {/* Raw output collapsible */}
                  {result.output && (
                    <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 px-2">
                          <ChevronDown
                            className={`h-3 w-3 transition-transform ${rawOpen ? 'rotate-180' : ''}`}
                          />
                          Raw Output
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto max-h-48 mt-1">
                          {result.output}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
