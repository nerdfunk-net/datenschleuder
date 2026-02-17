import type {
  DeploymentConfig,
  NifiInstance,
  RegistryFlow,
  DeploymentSettings,
  ProcessGroupPath,
} from '../types'
import type { NifiFlow } from '@/components/features/flows/manage/types'

/**
 * Build deployment configs from selected flows and their targets
 * This creates one config per flow+target combination
 */
export function buildDeploymentConfigs(
  flows: NifiFlow[],
  selectedFlowIds: number[],
  deploymentTargets: Record<number, 'source' | 'destination' | 'both'>,
  nifiInstances: NifiInstance[],
  registryFlows: RegistryFlow[],
  hierarchyAttributes: { name: string; label: string; order: number }[]
): DeploymentConfig[] {
  const configs: DeploymentConfig[] = []

  const selectedFlows = flows.filter((flow) => selectedFlowIds.includes(flow.id))

  for (const flow of selectedFlows) {
    const target = deploymentTargets[flow.id]
    if (!target) continue

    const targets: Array<'source' | 'destination'> =
      target === 'both' ? ['destination', 'source'] : [target]

    for (const deployTarget of targets) {
      const config = buildSingleConfig(
        flow,
        deployTarget,
        nifiInstances,
        registryFlows,
        hierarchyAttributes
      )
      if (config) {
        configs.push(config)
      }
    }
  }

  return configs
}

/**
 * Build a single deployment config for a flow+target
 */
function buildSingleConfig(
  flow: NifiFlow,
  target: 'source' | 'destination',
  nifiInstances: NifiInstance[],
  registryFlows: RegistryFlow[],
  hierarchyAttributes: { name: string; label: string; order: number }[]
): DeploymentConfig | null {
  // Get top hierarchy attribute (e.g., "DC")
  const topAttribute = hierarchyAttributes[0]
  if (!topAttribute) {
    console.warn('[buildSingleConfig] No hierarchy attributes configured')
    return null
  }

  // Get hierarchy value for this target
  const hierarchyValues = flow.hierarchy_values?.[topAttribute.name]
  const hierarchyValue = target === 'source' ? hierarchyValues?.source : hierarchyValues?.destination

  if (!hierarchyValue) {
    console.warn(`[buildSingleConfig] No hierarchy value for ${target} in flow ${flow.id}`)
    return null
  }

  console.warn(`[buildSingleConfig] Looking for instance with attribute="${topAttribute.name}" value="${hierarchyValue}"`)
  console.warn(`[buildSingleConfig] Available instances:`, nifiInstances.map(i => ({ id: i.id, attr: i.hierarchy_attribute, val: i.hierarchy_value })))

  // Find matching NiFi instance
  const instance = nifiInstances.find(
    (inst) => inst.hierarchy_attribute === topAttribute.name && inst.hierarchy_value === hierarchyValue
  )

  if (!instance) {
    console.warn(`[buildSingleConfig] No instance found for ${topAttribute.name}=${hierarchyValue}`)
  } else {
    console.warn(`[buildSingleConfig] Found instance:`, instance.id, instance.name)
  }

  // Get template ID based on target
  const templateId = target === 'source' ? flow.src_template_id : flow.dest_template_id
  if (!templateId) return null

  // Find registry flow info for this template
  // The template ID is the registry_flows.id
  const registryFlow = registryFlows.find((rf) => rf.id === templateId)

  return {
    key: `${flow.id}-${target}`,
    flowId: flow.id,
    flowName: flow.name || `Flow ${flow.id}`,
    target,
    hierarchyValue,
    instanceId: instance?.id || null,
    availablePaths: [],
    selectedProcessGroupId: '',
    suggestedPath: null,
    templateId,
    templateName: registryFlow?.flow_name || null,
    processGroupName: hierarchyValue, // Default name (will be updated with template)
    parameterContextName: null,
    availableVersions: [],
    selectedVersion: null, // null = latest
    registryId: registryFlow?.registry_id || null,
    bucketId: registryFlow?.bucket_id || null,
    flowIdRegistry: registryFlow?.flow_id || null,
  }
}

/**
 * Auto-select process group based on deployment settings
 */
export function autoSelectProcessGroup(
  config: DeploymentConfig,
  settings: DeploymentSettings,
  _hierarchyAttributes: { name: string; label: string; order: number }[]
): string | null {
  if (!config.instanceId || config.availablePaths.length === 0) {
    return null
  }

  // Get configured path for this instance+target
  const instancePaths = settings.paths[config.instanceId.toString()]
  const configuredPath = config.target === 'source' ? instancePaths?.source_path : instancePaths?.dest_path

  if (!configuredPath) {
    return null
  }

  // Try to match configured path with available paths
  const matchingPath = config.availablePaths.find((path) => {
    // Check if path matches the configured pattern
    // E.g., configured: "NiFi Flow/Engineering" matches "NiFi Flow/Engineering/DataPipeline"
    return path.path.startsWith(configuredPath) || path.formatted_path.includes(configuredPath)
  })

  return matchingPath?.id || null
}

/**
 * Generate process group name from template
 * Template placeholders: {last_hierarchy_value}, {flow_name}, {template_name}
 */
export function generateProcessGroupName(
  template: string,
  config: DeploymentConfig,
  flow: NifiFlow,
  hierarchyAttributes: { name: string; label: string; order: number }[]
): string {
  let name = template

  // Replace {last_hierarchy_value}
  const lastHierarchyAttr = hierarchyAttributes[hierarchyAttributes.length - 1]
  if (lastHierarchyAttr) {
    const hierarchyValues = flow.hierarchy_values?.[lastHierarchyAttr.name]
    const lastValue =
      config.target === 'source' ? hierarchyValues?.source : hierarchyValues?.destination
    name = name.replace('{last_hierarchy_value}', lastValue || config.hierarchyValue)
  }

  // Replace {flow_name}
  name = name.replace('{flow_name}', config.flowName)

  // Replace {template_name}
  name = name.replace('{template_name}', config.templateName || 'Template')

  return name
}

/**
 * Get suggested path hint for user
 */
export function getSuggestedPath(
  config: DeploymentConfig,
  settings: DeploymentSettings
): string | null {
  if (!config.instanceId) return null

  const instancePaths = settings.paths[config.instanceId.toString()]
  const configuredPath = config.target === 'source' ? instancePaths?.source_path : instancePaths?.dest_path

  if (configuredPath) {
    return `Suggested: ${configuredPath}`
  }

  return null
}

/**
 * Format path for display in dropdown
 */
export function formatPathForDisplay(path: ProcessGroupPath): string {
  return path.formatted_path || path.path
}

/**
 * Get selected path display text
 */
export function getSelectedPathDisplay(
  config: DeploymentConfig,
  paths: ProcessGroupPath[]
): string {
  const selectedPath = paths.find((p) => p.id === config.selectedProcessGroupId)
  return selectedPath ? formatPathForDisplay(selectedPath) : 'Select process group...'
}

/**
 * Calculate hierarchy attribute for backend deployment
 * This determines how many hierarchy levels to include
 */
export function getHierarchyAttributeForProcessGroup(
  processGroupId: string,
  paths: ProcessGroupPath[]
): string | undefined {
  const path = paths.find((p) => p.id === processGroupId)
  if (!path) return undefined

  // Use the level from the path to determine hierarchy depth
  // Level 0 = root, Level 1 = DC, Level 2 = DC + Region, etc.
  return path.level > 0 ? `level_${path.level}` : undefined
}

/**
 * Sort deployment configs: destination first, then source (per flow)
 * This ensures receivers are ready before senders start
 */
export function sortDeploymentConfigs(configs: DeploymentConfig[]): DeploymentConfig[] {
  return [...configs].sort((a, b) => {
    // First sort by flow ID
    if (a.flowId !== b.flowId) {
      return a.flowId - b.flowId
    }

    // Then destination before source
    if (a.target === 'destination' && b.target === 'source') {
      return -1
    }
    if (a.target === 'source' && b.target === 'destination') {
      return 1
    }

    return 0
  })
}
