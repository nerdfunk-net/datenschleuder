'use client'

import { useState, useMemo, useCallback } from 'react'
import { UseMutationResult } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Loader2, ChevronDown, Terminal, BarChart2, Server, Play } from 'lucide-react'
import { parseCapabilities } from '../utils/format-utils'
import { useAgentRepositoriesQuery } from '../hooks/use-agent-repositories-query'
import { useAgentContainersQuery } from '../hooks/use-agent-containers-query'
import type { CommandResult, ContainerListRow, DockerPsRow, DockerStatsRow, GitStatusRow, RepositoryListRow } from '../types'

interface RunCommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  capabilities: string
  sendCommand: UseMutationResult<
    CommandResult,
    Error,
    { agent_id: string; command: string; params?: Record<string, unknown> }
  >
}

type AnyRow = DockerPsRow | DockerStatsRow | ContainerListRow | RepositoryListRow | GitStatusRow

function isGitStatusRows(rows: AnyRow[]): rows is GitStatusRow[] {
  if (rows.length === 0) return false
  return 'repo' in rows[0]! && 'branch' in rows[0]!
}

function isRepositoryListRows(rows: AnyRow[]): rows is RepositoryListRow[] {
  if (rows.length === 0) return false
  const first = rows[0]!
  return Object.keys(first).length === 1 && 'id' in first
}

function isContainerListRows(rows: AnyRow[]): rows is ContainerListRow[] {
  if (rows.length === 0) return false
  const first = rows[0]!
  return 'id' in first && 'type' in first && !('names' in first) && !('cpu_percent' in first)
}

function isDockerPsRows(rows: AnyRow[]): rows is DockerPsRow[] {
  if (rows.length === 0) return false
  return 'names' in rows[0]!
}

const GIT_STATUS_BADGE: Record<string, string> = {
  clean:           'bg-green-100 text-green-700',
  modified:        'bg-yellow-100 text-yellow-700',
  'staged':        'bg-blue-100 text-blue-700',
  'staged+modified':'bg-purple-100 text-purple-700',
  untracked:       'bg-slate-100 text-slate-600',
  deleted:         'bg-red-100 text-red-600',
  'staged deleted':'bg-red-100 text-red-700',
  added:           'bg-emerald-100 text-emerald-700',
  'added+modified':'bg-teal-100 text-teal-700',
  renamed:         'bg-indigo-100 text-indigo-700',
  conflict:        'bg-rose-100 text-rose-700',
}

const TYPE_BADGE: Record<string, string> = {
  nifi: 'bg-blue-100 text-blue-700',
  zookeeper: 'bg-orange-100 text-orange-700',
}

export function RunCommandDialog({
  open,
  onOpenChange,
  agentId,
  capabilities,
  sendCommand,
}: RunCommandDialogProps) {
  const [selectedCommand, setSelectedCommand] = useState<string>('')
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [selectedContainers, setSelectedContainers] = useState<string[]>([])
  const [result, setResult] = useState<CommandResult | null>(null)
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [rawOpen, setRawOpen] = useState(false)

  const commands = useMemo(() => parseCapabilities(capabilities), [capabilities])

  const isGitCommand = selectedCommand === 'git_pull' || selectedCommand === 'git_push' || selectedCommand === 'git_status'
  const isDockerRestart = selectedCommand === 'docker_restart'

  const { data: reposData, isLoading: reposLoading } = useAgentRepositoriesQuery(agentId, {
    enabled: isGitCommand,
  })
  const repos = reposData?.repositories ?? []

  const { data: containersData, isLoading: containersLoading } = useAgentContainersQuery(agentId, {
    enabled: isDockerRestart,
  })
  const containers = containersData?.containers ?? []

  const handleCommandChange = useCallback((cmd: string) => {
    setSelectedCommand(cmd)
    setSelectedRepos([])
    setSelectedContainers([])
    setResult(null)
    setRawOpen(false)
  }, [])

  const handleToggleRepo = useCallback((id: string) => {
    setSelectedRepos((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedRepos((prev) =>
      prev.length === repos.length ? [] : repos.map((r) => r.id),
    )
  }, [repos])

  const handleToggleContainer = useCallback((id: string) => {
    setSelectedContainers((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }, [])

  const handleSelectAllContainers = useCallback(() => {
    setSelectedContainers((prev) =>
      prev.length === containers.length ? [] : containers.map((c) => c.id),
    )
  }, [containers])

  const isRunDisabled =
    !selectedCommand ||
    sendCommand.isPending ||
    (isGitCommand && selectedRepos.length === 0) ||
    (isDockerRestart && selectedContainers.length === 0)

  const handleRun = async () => {
    if (!selectedCommand) return
    setResult(null)
    setRawOpen(false)
    setLastCommand(selectedCommand)
    try {
      const params: Record<string, unknown> = {}
      if (isGitCommand) {
        params.repository_ids = selectedRepos
      }
      if (isDockerRestart) {
        params.container_ids = selectedContainers
      }
      const data = await sendCommand.mutateAsync({
        agent_id: agentId,
        command: selectedCommand,
        params,
      })
      setResult(data)
    } catch {
      // error toast handled by mutation's onError
    }
  }

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedCommand('')
        setSelectedRepos([])
        setSelectedContainers([])
        setResult(null)
        setRawOpen(false)
      }
      onOpenChange(open)
    },
    [onOpenChange],
  )

  const parsedRows = result?.parsed_output ?? null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              <div className="flex items-center gap-3">
                <Select value={selectedCommand} onValueChange={handleCommandChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a command…" />
                  </SelectTrigger>
                  <SelectContent>
                    {commands.map((cmd) => (
                      <SelectItem key={cmd} value={cmd}>
                        <span className="font-mono text-sm">{cmd}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={isRunDisabled}
                  onClick={handleRun}
                >
                  {sendCommand.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1.5" />
                  )}
                  Run
                </Button>
              </div>

              {/* Container selector — shown for docker_restart */}
              {isDockerRestart && (
                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Select containers to restart
                    </span>
                    {containers.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={handleSelectAllContainers}
                      >
                        {selectedContainers.length === containers.length ? 'Deselect all' : 'Select all'}
                      </Button>
                    )}
                  </div>

                  {containersLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading containers…
                    </div>
                  ) : containers.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      No containers found on this agent.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {containers.map((container) => (
                        <label
                          key={container.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedContainers.includes(container.id)}
                            onCheckedChange={() => handleToggleContainer(container.id)}
                          />
                          <span className="font-mono text-sm flex-1">{container.id}</span>
                          {container.type && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              {container.type}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Repository selector — shown for git_pull and git_status */}
              {isGitCommand && (
                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {selectedCommand === 'git_push' ? 'Select repositories to push' : 'Select repositories to pull'}
                    </span>
                    {repos.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={handleSelectAll}
                      >
                        {selectedRepos.length === repos.length ? 'Deselect all' : 'Select all'}
                      </Button>
                    )}
                  </div>

                  {reposLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading repositories…
                    </div>
                  ) : repos.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      No repositories found on this agent.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {repos.map((repo) => (
                        <label
                          key={repo.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedRepos.includes(repo.id)}
                            onCheckedChange={() => handleToggleRepo(repo.id)}
                          />
                          <span className="font-mono text-sm">{repo.id}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                  <p className="text-xs mt-1">Select a command above and click Run</p>
                </div>
              )}

              {/* Results */}
              {!sendCommand.isPending && result && (
                <div className="space-y-3">
                  {parsedRows && parsedRows.length > 0 ? (
                    <div className="border rounded-md overflow-auto">
                      {isGitStatusRows(parsedRows) ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-xs font-semibold">Repository</TableHead>
                              <TableHead className="text-xs font-semibold">Branch</TableHead>
                              <TableHead className="text-xs font-semibold">File</TableHead>
                              <TableHead className="text-xs font-semibold">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(parsedRows as GitStatusRow[]).map((row, i) => {
                              const prevRow = (parsedRows as GitStatusRow[])[i - 1]
                              const isFirstInRepo = !prevRow || prevRow.repo !== row.repo
                              return (
                                <TableRow key={`${row.repo}-${row.file || 'clean'}-${i}`} className={isFirstInRepo && i > 0 ? 'border-t-2 border-slate-200' : ''}>
                                  <TableCell className={`font-mono text-xs font-medium ${isFirstInRepo ? '' : 'text-transparent select-none'}`}>
                                    {isFirstInRepo ? row.repo : '↳'}
                                  </TableCell>
                                  <TableCell className={`text-xs text-muted-foreground ${isFirstInRepo ? '' : 'opacity-0'}`}>
                                    {isFirstInRepo ? row.branch : ''}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {row.file || '—'}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${GIT_STATUS_BADGE[row.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                      {row.status}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      ) : isRepositoryListRows(parsedRows) ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-xs font-semibold">Repository ID</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(parsedRows as RepositoryListRow[]).map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-mono text-xs font-medium">{row.id}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : isContainerListRows(parsedRows) ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="text-xs font-semibold">Container ID</TableHead>
                              <TableHead className="text-xs font-semibold">Type</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(parsedRows as ContainerListRow[]).map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-mono text-xs font-medium">{row.id}</TableCell>
                                <TableCell>
                                  {row.type ? (
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_BADGE[row.type] ?? 'bg-slate-100 text-slate-600'}`}>
                                      {row.type}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : isDockerPsRows(parsedRows) ? (
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
