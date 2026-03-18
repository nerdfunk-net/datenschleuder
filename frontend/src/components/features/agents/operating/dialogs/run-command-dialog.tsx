'use client'

import { useState } from 'react'
import { UseMutationResult } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
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

const schema = z.object({
  command: z.string().min(1, 'Command is required'),
  params: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface RunCommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  sendCommand: UseMutationResult<
    CommandResult,
    Error,
    { agent_id: string; command: string; params?: Record<string, unknown> }
  >
}

function isDockerPsRows(rows: DockerPsRow[] | DockerStatsRow[]): rows is DockerPsRow[] {
  return rows.length === 0 || ('names' in (rows[0] as DockerPsRow))
}

export function RunCommandDialog({ open, onOpenChange, agentId, sendCommand }: RunCommandDialogProps) {
  const [result, setResult] = useState<CommandResult | null>(null)
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [rawOpen, setRawOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { command: '', params: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setResult(null)
    setRawOpen(false)
    setLastCommand(values.command)
    let params: Record<string, unknown> = {}
    if (values.params?.trim()) {
      try {
        params = JSON.parse(values.params)
      } catch {
        form.setError('params', { message: 'Invalid JSON' })
        return
      }
    }
    try {
      const data = await sendCommand.mutateAsync({
        agent_id: agentId,
        command: values.command,
        params,
      })
      setResult(data)
    } catch {
      // error toast handled by mutation's onError
    }
  }

  const parsedRows = result?.parsed_output ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-[80vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Terminal className="h-5 w-5 text-blue-600" />
            Run Command — <span className="font-mono text-blue-600">{agentId}</span>
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
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="command"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Command</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. echo, docker_ps, docker_stats, git_pull"
                            className="font-mono"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="params"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Params (JSON, optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"key": "value"}'
                            className="font-mono text-xs"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="sm" disabled={sendCommand.isPending}>
                    {sendCommand.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Terminal className="h-3 w-3 mr-1.5" />
                    )}
                    Run
                  </Button>
                </form>
              </Form>
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
                <span className="text-xs text-blue-100 font-mono">{lastCommand}</span>
              )}
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
              {/* Loading */}
              {sendCommand.isPending && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Running <span className="font-mono">{lastCommand}</span>…
                  </span>
                </div>
              )}

              {/* Empty state */}
              {!sendCommand.isPending && !result && (
                <div className="text-center py-8 text-gray-400">
                  <Server className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No results yet</p>
                  <p className="text-xs mt-1">Enter a command above and click Run</p>
                </div>
              )}

              {/* Results */}
              {!sendCommand.isPending && result && (
                <div className="space-y-3">
                  {parsedRows && parsedRows.length > 0 ? (
                    <div className="border rounded-md overflow-auto">
                      {isDockerPsRows(parsedRows) ? (
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
                    result.output && (
                      <p className="text-sm text-muted-foreground">No structured data — see raw output below.</p>
                    )
                  )}

                  {!parsedRows && !result.output && (
                    <p className="text-sm text-muted-foreground">Command completed with no output.</p>
                  )}

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
