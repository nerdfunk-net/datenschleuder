'use client'

interface FlowSummaryCardsProps {
  totalFlows: number
  healthyCount: number
  unhealthyCount: number
  unknownCount: number
}

export function FlowSummaryCards({
  totalFlows,
  healthyCount,
  unhealthyCount,
  unknownCount,
}: FlowSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Total Flows</p>
        <p className="text-2xl font-bold text-slate-900">{totalFlows}</p>
      </div>
      <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Healthy</p>
        <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
      </div>
      <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Issues</p>
        <p className="text-2xl font-bold text-red-600">{unhealthyCount}</p>
      </div>
      <div className="shadow-sm border border-gray-200 bg-white rounded-lg p-4">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Unknown</p>
        <p className="text-2xl font-bold text-gray-500">{unknownCount}</p>
      </div>
    </div>
  )
}
