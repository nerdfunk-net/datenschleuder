import type { NifiCluster, NifiInstance } from '../types'

// Complete Tailwind gradient strings — must not be dynamically constructed
const CLUSTER_PALETTES = [
  'from-blue-500/80 to-blue-600/80',
  'from-slate-500/80 to-slate-600/80',
  'from-sky-400/80 to-sky-500/80',
  'from-gray-500/80 to-gray-600/80',
  'from-blue-700/80 to-blue-800/80',
  'from-zinc-500/80 to-zinc-600/80',
  'from-sky-600/80 to-sky-700/80',
  'from-slate-400/80 to-slate-500/80',
] as const

export const DEFAULT_HEADER_GRADIENT = 'from-blue-400/80 to-blue-500/80'

export interface ClusterColorInfo {
  gradient: string
  clusterLabel: string
}

/**
 * Builds a stable map from cluster DB id → color info.
 * Clusters are sorted by id for consistent ordering across tabs.
 */
export function buildClusterColorMap(clusters: NifiCluster[]): Map<number, ClusterColorInfo> {
  const map = new Map<number, ClusterColorInfo>()
  const sorted = [...clusters].sort((a, b) => a.id - b.id)
  sorted.forEach((cluster, index) => {
    map.set(cluster.id, {
      gradient: CLUSTER_PALETTES[index % CLUSTER_PALETTES.length]!,
      clusterLabel: cluster.cluster_id,
    })
  })
  return map
}

/** Returns color info for a NiFi instance by instance ID. */
export function getInstanceColorInfo(
  instanceId: number,
  clusters: NifiCluster[],
  colorMap: Map<number, ClusterColorInfo>
): ClusterColorInfo | null {
  for (const cluster of clusters) {
    if (cluster.members.some(m => m.instance_id === instanceId)) {
      return colorMap.get(cluster.id) ?? null
    }
  }
  return null
}

/** Returns color info for a server by server ID, resolved via instances. */
export function getServerColorInfo(
  serverId: number,
  instances: NifiInstance[],
  clusters: NifiCluster[],
  colorMap: Map<number, ClusterColorInfo>
): ClusterColorInfo | null {
  const inst = instances.find(i => i.server_id === serverId)
  if (!inst) return null
  return getInstanceColorInfo(inst.id, clusters, colorMap)
}
