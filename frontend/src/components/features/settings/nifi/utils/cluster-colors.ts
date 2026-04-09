import type { NifiCluster, NifiInstance } from '../types'

// Complete Tailwind gradient/badge strings — must not be dynamically constructed
const CLUSTER_PALETTES: Array<{ gradient: string; badgeClass: string }> = [
  { gradient: 'from-blue-500/80 to-blue-600/80',   badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200' },
  { gradient: 'from-slate-500/80 to-slate-600/80', badgeClass: 'bg-slate-100 text-slate-800 border border-slate-200' },
  { gradient: 'from-sky-400/80 to-sky-500/80',     badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200' },
  { gradient: 'from-gray-500/80 to-gray-600/80',   badgeClass: 'bg-gray-100 text-gray-800 border border-gray-200' },
  { gradient: 'from-blue-700/80 to-blue-800/80',   badgeClass: 'bg-blue-200 text-blue-900 border border-blue-300' },
  { gradient: 'from-zinc-500/80 to-zinc-600/80',   badgeClass: 'bg-zinc-100 text-zinc-800 border border-zinc-200' },
  { gradient: 'from-sky-600/80 to-sky-700/80',     badgeClass: 'bg-sky-200 text-sky-900 border border-sky-300' },
  { gradient: 'from-slate-400/80 to-slate-500/80', badgeClass: 'bg-slate-50 text-slate-700 border border-slate-200' },
]

export const DEFAULT_HEADER_GRADIENT = 'from-blue-400/80 to-blue-500/80'

export interface ClusterColorInfo {
  gradient: string
  badgeClass: string
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
    const palette = CLUSTER_PALETTES[index % CLUSTER_PALETTES.length]!
    map.set(cluster.id, {
      gradient: palette.gradient,
      badgeClass: palette.badgeClass,
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
