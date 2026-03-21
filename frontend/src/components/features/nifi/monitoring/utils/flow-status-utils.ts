import type { Flow, FlowType, FlowStatus, ProcessGroupStatus } from '../types'

export function getFlowItemKey(flowId: number, flowType: FlowType): string {
  return `${flowId}_${flowType}`
}

export function determineFlowStatus(statusData: ProcessGroupStatus): FlowStatus {
  if (!statusData?.data) return 'unknown'
  const data = statusData.data
  if (data.not_deployed) return 'unhealthy'

  const bulletins = data.bulletins ?? []
  const stoppedCount = data.stopped_count ?? 0
  const disabledCount = data.disabled_count ?? 0
  const invalidCount = data.invalid_count ?? 0

  let queuedCount = 0
  const queuedCountValue = data.status?.aggregate_snapshot?.queued_count
  if (queuedCountValue !== undefined && queuedCountValue !== null) {
    queuedCount =
      typeof queuedCountValue === 'string' ? parseInt(queuedCountValue, 10) : queuedCountValue
  }

  if (
    bulletins.length === 0 &&
    stoppedCount === 0 &&
    disabledCount === 0 &&
    invalidCount === 0 &&
    queuedCount === 0
  ) {
    return 'healthy'
  }
  if (bulletins.length > 0 || stoppedCount > 0) return 'issues'
  return 'warning'
}

export function getFlowDisplayName(flow: Flow, flowType: FlowType): string {
  if (!flow) return 'Unnamed Flow'
  const flowName = flow.name ?? 'Unnamed'
  const prefix = flowType === 'source' ? 'src_' : 'dest_'
  const hierarchyParts: string[] = Object.keys(flow)
    .filter(
      (key) =>
        key.startsWith(prefix) &&
        key !== `${prefix}connection_param` &&
        key !== `${prefix}template_id`,
    )
    .sort()
    .map((key) => flow[key] as string)
    .filter(Boolean)

  if (hierarchyParts.length > 0) return `${flowName} / ${hierarchyParts.join('/')}`
  return flowName
}

export function getStatusText(statusData: ProcessGroupStatus | undefined, status: FlowStatus): string {
  if (statusData?.data?.not_deployed) return 'Not Deployed'
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'unhealthy':
      return 'Not Deployed'
    case 'issues':
      return 'Issues Detected'
    case 'warning':
      return 'Warning'
    default:
      return 'Status Unknown'
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function getProcessorCounts(statusData: ProcessGroupStatus | undefined): string {
  if (!statusData?.data) return 'N/A'
  const d = statusData.data
  return `${d.running_count ?? 0}/${d.stopped_count ?? 0}/${d.invalid_count ?? 0}/${d.disabled_count ?? 0}`
}

export function getFlowFileStats(statusData: ProcessGroupStatus | undefined): string {
  const snapshot = statusData?.data?.status?.aggregate_snapshot
  if (!snapshot) return 'N/A'
  return `${snapshot.flow_files_in ?? 0}(${formatBytes(snapshot.bytes_in)})/${snapshot.flow_files_out ?? 0}(${formatBytes(snapshot.bytes_out)})/${snapshot.flow_files_sent ?? 0}(${formatBytes(snapshot.bytes_in)})`
}

export function getQueueStats(statusData: ProcessGroupStatus | undefined): string {
  const snapshot = statusData?.data?.status?.aggregate_snapshot
  if (!snapshot) return 'N/A'
  return `${snapshot.queued ?? '0'}/${snapshot.queued_count ?? '0'}/${String(snapshot.bytes_queued ?? '0 bytes')}`
}

export function getBulletinCount(statusData: ProcessGroupStatus | undefined): number {
  return statusData?.data?.bulletins?.length ?? 0
}

export function getBulletinInfo(statusData: ProcessGroupStatus | undefined): string {
  const count = getBulletinCount(statusData)
  return count > 0 ? `${count} issue${count > 1 ? 's' : ''}` : 'None'
}

export function getNiFiUrlFromStatus(
  statusData: ProcessGroupStatus | undefined,
  instances: { id: number; nifi_url: string }[],
): string | null {
  if (!statusData?.instance_id || !statusData?.process_group_id) return null
  const instance = instances.find((i) => i.id === statusData.instance_id)
  if (!instance) return null

  let nifiUrl = instance.nifi_url
  if (nifiUrl.includes('/nifi-api')) {
    nifiUrl = nifiUrl.replace('/nifi-api', '/nifi')
  } else if (nifiUrl.endsWith('/')) {
    nifiUrl = nifiUrl.slice(0, -1) + '/nifi'
  } else {
    nifiUrl = nifiUrl + '/nifi'
  }
  return `${nifiUrl}/#/process-groups/${statusData.process_group_id}`
}
