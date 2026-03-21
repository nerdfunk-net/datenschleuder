import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Info, ExternalLink, CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react'
import type { Flow, FlowType, FlowStatus, ProcessGroupStatus } from '../types'
import {
  determineFlowStatus,
  getStatusText,
  getFlowDisplayName,
  getNiFiUrlFromStatus,
  getProcessorCounts,
  getFlowFileStats,
  getQueueStats,
  getBulletinCount,
  getBulletinInfo,
} from '../utils/flow-status-utils'

const WIDGET_STATUS_CLASSES: Record<FlowStatus, string> = {
  healthy: 'bg-green-50 border border-green-200',
  unhealthy: 'bg-red-50 border border-red-200',
  issues: 'bg-amber-50 border border-amber-200',
  warning: 'bg-amber-50 border border-amber-200',
  unknown: 'bg-gray-100 border border-gray-200',
}

const WIDGET_ICON: Record<FlowStatus, React.ReactNode> = {
  healthy: <CheckCircle2 className="h-4 w-4 text-green-700" />,
  unhealthy: <XCircle className="h-4 w-4 text-red-700" />,
  issues: <AlertTriangle className="h-4 w-4 text-amber-700" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-700" />,
  unknown: <HelpCircle className="h-4 w-4 text-gray-500" />,
}

interface FlowWidgetProps {
  flow: Flow
  flowType: FlowType
  statusData: ProcessGroupStatus | undefined
  highlighted: boolean
  instances: { id: number; nifi_url: string }[]
  onCardClick: () => void
  onInfoClick: () => void
  onStatusClick: () => void
}

export function FlowWidget({
  flow,
  flowType,
  statusData,
  highlighted,
  instances,
  onCardClick,
  onInfoClick,
  onStatusClick,
}: FlowWidgetProps) {
  const status = statusData ? determineFlowStatus(statusData) : 'unknown'
  const statusText = getStatusText(statusData, status)
  const displayName = getFlowDisplayName(flow, flowType)
  const nifiUrl = getNiFiUrlFromStatus(statusData, instances)
  const hasStatusData = !!statusData

  return (
    <div
      className={`rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${WIDGET_STATUS_CLASSES[status]} ${
        highlighted ? 'ring-2 ring-blue-400 ring-offset-1 scale-[1.01] z-10' : ''
      }`}
      onClick={onCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2 pb-2 border-b border-black/10">
        <div className="flex-1 pr-2">
          <Badge
            className={`text-[10px] font-bold uppercase mb-1 ${
              flowType === 'source'
                ? 'bg-blue-500 text-white border-0'
                : 'bg-purple-500 text-white border-0'
            }`}
          >
            {flowType === 'source' ? 'Source' : 'Destination'}
          </Badge>
          <div
            className={`text-xs font-semibold text-slate-800 leading-tight ${
              nifiUrl ? 'text-blue-600 cursor-pointer underline decoration-dotted hover:decoration-solid' : ''
            }`}
            onClick={(e) => {
              if (nifiUrl) {
                e.stopPropagation()
                window.open(nifiUrl, '_blank')
              }
            }}
            title={nifiUrl ? 'Click to open in NiFi' : ''}
          >
            {displayName}
            {nifiUrl && <ExternalLink className="h-3 w-3 inline ml-1 opacity-60" />}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-1 rounded text-blue-500 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            disabled={!hasStatusData}
            title="View details"
            onClick={(e) => {
              e.stopPropagation()
              onInfoClick()
            }}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {WIDGET_ICON[status]}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">Flow ID:</span>
          <span className="font-semibold text-slate-700">#{flow.id}</span>
        </div>
        {hasStatusData && (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="running / stopped / invalid / disabled">
                Status:
              </span>
              <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">
                {getProcessorCounts(statusData)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="flow_files_in (bytes_in) / flow_files_out (bytes_out) / flow_files_sent (bytes_sent)">
                I/O:
              </span>
              <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">
                {getFlowFileStats(statusData)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="queued / queued_count / queued_size">
                Queue:
              </span>
              <span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">
                {getQueueStats(statusData)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium cursor-help underline decoration-dotted" title="Number of error bulletins">
                Bulletins:
              </span>
              <span className={`font-semibold text-right ${getBulletinCount(statusData) > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {getBulletinInfo(statusData)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="pt-1.5 border-t border-black/10 text-center">
        <button
          className="text-[10px] font-bold uppercase tracking-tight text-slate-600 hover:text-blue-600 hover:bg-black/5 px-2 py-0.5 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onStatusClick()
          }}
        >
          {statusText}
        </button>
      </div>
    </div>
  )
}
