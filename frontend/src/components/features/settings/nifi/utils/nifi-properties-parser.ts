import type { NifiProperty, NifiPropertyGroup } from '../types'

/**
 * Parse nifi.properties content into NifiProperty array.
 * Only key=value lines are included (comments and blanks are excluded from editing
 * but preserved in the original content on save).
 */
export function parseNifiProperties(content: string): NifiProperty[] {
  const properties: NifiProperty[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    if (rawLine === undefined) continue
    const line = rawLine.trim()

    // Skip blank lines
    if (!line) continue

    // Handle commented-out properties (lines starting with # that contain =)
    if (line.startsWith('#')) {
      continue
    }

    // Parse key=value lines
    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue

    const key = line.substring(0, eqIndex).trim()
    const value = line.substring(eqIndex + 1).trim()

    properties.push({
      lineNumber: i + 1,
      key,
      value,
      isComment: false,
    })
  }

  return properties
}

/**
 * Group properties by their first 2 dot-separated segments.
 * e.g., "nifi.flow.configuration.file" -> group "nifi.flow"
 */
export function groupNifiProperties(properties: NifiProperty[]): NifiPropertyGroup[] {
  const groupMap = new Map<string, NifiProperty[]>()

  for (const prop of properties) {
    const parts = prop.key.split('.')
    const prefix = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : (parts[0] ?? prop.key)

    const existing = groupMap.get(prefix)
    if (existing) {
      existing.push(prop)
    } else {
      groupMap.set(prefix, [prop])
    }
  }

  return Array.from(groupMap.entries()).map(([prefix, props]) => ({
    prefix,
    properties: props,
  }))
}

/**
 * Generate nifi.properties content by replacing only changed values
 * in the original content. Preserves all comments, blanks, and structure.
 */
export function generateNifiProperties(
  original: string,
  updated: NifiProperty[]
): string {
  // Build a map of lineNumber -> new value
  const valueMap = new Map<number, string>()
  for (const prop of updated) {
    valueMap.set(prop.lineNumber, prop.value)
  }

  const lines = original.split('\n')

  return lines
    .map((line, index) => {
      const lineNumber = index + 1
      const newValue = valueMap.get(lineNumber)
      if (newValue === undefined) return line

      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed.includes('=')) return line

      const eqIndex = trimmed.indexOf('=')
      const key = trimmed.substring(0, eqIndex).trim()

      return `${key}=${newValue}`
    })
    .join('\n')
}
