/**
 * Format a unix timestamp as relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/**
 * Format uptime from a unix timestamp to a human-readable duration
 */
export function formatUptime(startedAt: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - startedAt

  if (diff < 60) return `${diff}s`
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins}m`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    const mins = Math.floor((diff % 3600) / 60)
    return `${hours}h ${mins}m`
  }
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  return `${days}d ${hours}h`
}

/**
 * Parse JSON capabilities string into array of {id, name} objects.
 * Handles:
 *   - JSON array of objects: [{"id": "echo", "name": "Echo"}, ...]
 *   - JSON array of strings: ["echo", "git_pull", ...]
 *   - Comma-separated string: "echo,git_pull,..." (legacy fallback)
 */
export function parseCapabilities(capabilities: string): { id: string; name: string; description?: string }[] {
  if (!capabilities) return []
  try {
    const parsed = JSON.parse(capabilities)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (typeof item === 'string') return { id: item, name: item }
        if (item && typeof item === 'object') {
          const id = String(item.id ?? '')
          const name = String(item.name ?? item.id ?? id)
          const description = item.description ? String(item.description) : undefined
          return { id, name, description }
        }
        return { id: String(item), name: String(item) }
      })
    }
  } catch {
    // fallback: treat as comma-separated ids (backward compat)
    return capabilities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((id) => ({ id, name: id }))
  }
  return []
}

/**
 * Format execution time in ms to readable string
 */
export function formatExecutionTime(ms: number | null): string {
  if (ms === null || ms === undefined) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
