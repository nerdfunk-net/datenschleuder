/**
 * Extracts a human-readable message from a raw API error string.
 * The backend returns HTTPException with a dict detail, e.g.:
 *   "API Error 502: {"detail": {"connected": false, "error": "some error"}}"
 */
export function tryParseNifiError(raw: string): string {
  try {
    const jsonStart = raw.indexOf('{')
    if (jsonStart === -1) return raw
    const parsed = JSON.parse(raw.slice(jsonStart))
    const detail = parsed?.detail
    if (!detail) return raw
    if (typeof detail === 'string') return detail
    if (typeof detail === 'object') {
      return detail.error || detail.message || JSON.stringify(detail)
    }
  } catch {
    // Not JSON, return as-is
  }
  return raw
}
