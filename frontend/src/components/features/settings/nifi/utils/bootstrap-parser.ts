import type { BootstrapConfig } from '../types'

/**
 * Parse bootstrap.conf content into a BootstrapConfig object.
 * Extracts run.as, java.arg.2 (Xms), java.arg.3 (Xmx), and preserve.environment.
 */
export function parseBootstrapConf(content: string): BootstrapConfig {
  const config: BootstrapConfig = {
    runAs: '',
    minRam: '1g',
    maxRam: '1g',
    preserveEnvironment: false,
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue

    const eqIndex = trimmed.indexOf('=')
    const key = trimmed.substring(0, eqIndex).trim()
    const value = trimmed.substring(eqIndex + 1).trim()

    if (key === 'run.as') {
      config.runAs = value
    } else if (key === 'preserve.environment') {
      config.preserveEnvironment = value === 'true'
    } else if (key === 'java.arg.2') {
      const match = value.match(/-Xms(.+)/)
      if (match?.[1]) config.minRam = match[1]
    } else if (key === 'java.arg.3') {
      const match = value.match(/-Xmx(.+)/)
      if (match?.[1]) config.maxRam = match[1]
    }
  }

  return config
}

/**
 * Generate bootstrap.conf content by replacing only the 4 managed values
 * in the original content, preserving all other lines/comments/structure.
 */
export function generateBootstrapConf(original: string, config: BootstrapConfig): string {
  return original
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed.includes('=')) return line

      const eqIndex = trimmed.indexOf('=')
      const key = trimmed.substring(0, eqIndex).trim()

      switch (key) {
        case 'run.as':
          return `run.as=${config.runAs}`
        case 'preserve.environment':
          return `preserve.environment=${config.preserveEnvironment}`
        case 'java.arg.2':
          return `java.arg.2=-Xms${config.minRam}`
        case 'java.arg.3':
          return `java.arg.3=-Xmx${config.maxRam}`
        default:
          return line
      }
    })
    .join('\n')
}
