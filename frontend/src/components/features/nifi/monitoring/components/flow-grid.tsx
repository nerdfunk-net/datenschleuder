'use client'

import React from 'react'
import { FlowWidget } from './flow-widget'
import type { Flow, FlowType, ProcessGroupStatus, NifiInstance } from '../types'

interface FlowGridProps {
  flows: Flow[]
  getFlowItemStatus: (flow: Flow, flowType: FlowType) => ProcessGroupStatus | undefined
  highlightedFlowId: number | null
  instances: NifiInstance[]
  onCardClick: (flow: Flow) => void
  onInfoClick: (flow: Flow, flowType: FlowType) => void
  onStatusClick: (flow: Flow, flowType: FlowType) => void
}

export function FlowGrid({
  flows,
  getFlowItemStatus,
  highlightedFlowId,
  instances,
  onCardClick,
  onInfoClick,
  onStatusClick,
}: FlowGridProps) {
  if (flows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">No flows match your filters</p>
        <p className="text-sm mt-1">Try adjusting the search or status filter</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {flows.map((flow) => (
        <React.Fragment key={flow.id}>
          <FlowWidget
            flow={flow}
            flowType="source"
            statusData={getFlowItemStatus(flow, 'source')}
            highlighted={highlightedFlowId === flow.id}
            instances={instances}
            onCardClick={() => onCardClick(flow)}
            onInfoClick={() => onInfoClick(flow, 'source')}
            onStatusClick={() => onStatusClick(flow, 'source')}
          />
          <FlowWidget
            flow={flow}
            flowType="destination"
            statusData={getFlowItemStatus(flow, 'destination')}
            highlighted={highlightedFlowId === flow.id}
            instances={instances}
            onCardClick={() => onCardClick(flow)}
            onInfoClick={() => onInfoClick(flow, 'destination')}
            onStatusClick={() => onStatusClick(flow, 'destination')}
          />
        </React.Fragment>
      ))}
    </div>
  )
}
