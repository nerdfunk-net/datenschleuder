'use client'

import { Server } from 'lucide-react'
import { AgentCard } from './agent-card'
import type { CockpitAgent } from '../types'

interface AgentsGridProps {
  agents: CockpitAgent[]
  onGetStats: (agentId: string) => void
  onRunCommand: (agentId: string) => void
  onViewHistory: (agentId: string) => void
}

export function AgentsGrid({ agents, onGetStats, onRunCommand, onViewHistory }: AgentsGridProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Server className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No agents registered</p>
        <p className="text-sm mt-1">Deploy a Cockpit agent to get started</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.agent_id}
          agent={agent}
          onGetStats={onGetStats}
          onRunCommand={onRunCommand}
          onViewHistory={onViewHistory}
        />
      ))}
    </div>
  )
}
