import type { CacheSettings } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_CACHE_SETTINGS: Partial<CacheSettings> = {
  enabled: true,
  ttl_seconds: 600,
} as const

export const STALE_TIME = {
  SETTINGS: 5 * 60 * 1000,  // 5 minutes - settings rarely change
  STATS: 0,                  // Always fresh - real-time stats
  ENTRIES: 10 * 1000,        // 10 seconds - moderate freshness
} as const
