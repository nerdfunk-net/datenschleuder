'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, RefreshCw, Server, Wifi, WifiOff, Loader2, BookOpen } from 'lucide-react'
import { useAgentsQuery } from './hooks/use-agents-query'
import { useAgentMutations } from './hooks/use-agent-mutations'
import { AgentsGrid } from './components/agents-grid'
import { DeployInstructions } from './components/deploy-instructions'
import { GetStatsDialog } from './dialogs/get-stats-dialog'
import { RunCommandDialog } from './dialogs/run-command-dialog'
import { CommandHistoryDialog } from './dialogs/command-history-dialog'
import { EMPTY_AGENTS } from './utils/constants'

export function AgentsOperatingPage() {
  const { data, isLoading, refetch, isFetching } = useAgentsQuery()
  const { sendCommand } = useAgentMutations()

  const agents = data?.agents ?? EMPTY_AGENTS

  const [statsAgent, setStatsAgent] = useState<string | null>(null)
  const [runCommandAgent, setRunCommandAgent] = useState<string | null>(null)
  const [historyAgent, setHistoryAgent] = useState<string | null>(null)

  const stats = useMemo(() => {
    const online = agents.filter((a) => a.status === 'online').length
    return { total: agents.length, online, offline: agents.length - online }
  }, [agents])

  const handleGetStats = useCallback((agentId: string) => setStatsAgent(agentId), [])
  const handleRunCommand = useCallback((agentId: string) => setRunCommandAgent(agentId), [])
  const handleViewHistory = useCallback((agentId: string) => setHistoryAgent(agentId), [])
  const handleRefresh = useCallback(() => refetch(), [refetch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Agents Operating</h1>
            <p className="text-muted-foreground mt-2">Monitor and manage running Cockpit agents</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Agents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <Wifi className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.online}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <WifiOff className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.offline}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Running Agents */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">Running Agents</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              <span className="ml-2 text-sm text-muted-foreground">Loading agents...</span>
            </div>
          ) : (
            <AgentsGrid
              agents={agents}
              onGetStats={handleGetStats}
              onRunCommand={handleRunCommand}
              onViewHistory={handleViewHistory}
            />
          )}
        </div>
      </div>

      {/* Deployment Instructions */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <BookOpen className="h-4 w-4" />
          <span className="text-sm font-medium">Deployment Instructions</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <DeployInstructions />
        </div>
      </div>

      {/* Dialogs */}
      {statsAgent && (
        <GetStatsDialog
          open={!!statsAgent}
          onOpenChange={(open) => !open && setStatsAgent(null)}
          agentId={statsAgent}
          sendCommand={sendCommand}
        />
      )}
      {runCommandAgent && (
        <RunCommandDialog
          open={!!runCommandAgent}
          onOpenChange={(open) => !open && setRunCommandAgent(null)}
          agentId={runCommandAgent}
          sendCommand={sendCommand}
        />
      )}
      {historyAgent && (
        <CommandHistoryDialog
          open={!!historyAgent}
          onOpenChange={(open) => !open && setHistoryAgent(null)}
          agentId={historyAgent}
        />
      )}
    </div>
  )
}
