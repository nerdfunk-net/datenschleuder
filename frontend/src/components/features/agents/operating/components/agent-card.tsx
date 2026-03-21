'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart2, History, Clock, Terminal, Server, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime, formatUptime } from '../utils/format-utils'
import type { CockpitAgent } from '../types'

interface AgentCardProps {
  agent: CockpitAgent
  onGetStats: (agentId: string) => void
  onRunCommand: (agentId: string) => void
  onViewHistory: (agentId: string) => void
}

export function AgentCard({ agent, onGetStats, onRunCommand, onViewHistory }: AgentCardProps) {
  const isOnline = agent.status === 'online'

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        isOnline ? 'border-green-200' : 'border-red-200'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">{agent.hostname}</span>
          </div>
          <Badge
            variant={isOnline ? 'default' : 'destructive'}
            className={cn(
              'text-xs',
              isOnline && 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100'
            )}
          >
            {agent.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Agent info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-medium">Version:</span>
            <span>{agent.version}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(agent.last_heartbeat)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Uptime:</span>
            <span>{formatUptime(agent.started_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            <span>{agent.commands_executed} cmds</span>
          </div>
          {agent.redis_server_name && (
            <div className="flex items-center gap-1 col-span-2">
              <Database className="h-3 w-3" />
              <span>{agent.redis_server_name}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            disabled={!isOnline}
            onClick={() => onGetStats(agent.agent_id)}
          >
            <BarChart2 className="h-3 w-3 mr-1" />
            Get Stats
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            disabled={!isOnline}
            onClick={() => onRunCommand(agent.agent_id)}
          >
            <Terminal className="h-3 w-3 mr-1" />
            Run Command
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => onViewHistory(agent.agent_id)}
          >
            <History className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
