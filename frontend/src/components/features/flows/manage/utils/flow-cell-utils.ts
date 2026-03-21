import type { NifiFlow, FlowColumn, FlowFormValues, RegistryFlow } from '../types'
import type { HierarchyAttribute } from '@/components/features/settings/nifi/types'
import type { FlowPayload } from '../hooks/use-flows-mutations'

export function getFlowCellValue(
  flow: NifiFlow,
  columnKey: string,
  hierarchy: HierarchyAttribute[],
  registryFlows: RegistryFlow[],
): string | boolean {
  for (const attr of hierarchy) {
    const key = attr.name.toLowerCase()
    if (columnKey === `src_${key}`) return flow.hierarchy_values?.[attr.name]?.source ?? ''
    if (columnKey === `dest_${key}`) return flow.hierarchy_values?.[attr.name]?.destination ?? ''
  }
  switch (columnKey) {
    case 'name': return flow.name ?? ''
    case 'contact': return flow.contact ?? ''
    case 'active': return flow.active
    case 'src_connection_param': return flow.src_connection_param
    case 'dest_connection_param': return flow.dest_connection_param
    case 'src_template': {
      const tmpl = registryFlows.find(r => r.id === flow.src_template_id)
      return tmpl ? `${tmpl.flow_name} (${tmpl.nifi_instance_name})` : ''
    }
    case 'dest_template': {
      const tmpl = registryFlows.find(r => r.id === flow.dest_template_id)
      return tmpl ? `${tmpl.flow_name} (${tmpl.nifi_instance_name})` : ''
    }
    case 'description': return flow.description ?? ''
    case 'creator_name': return flow.creator_name ?? ''
    case 'created_at': return new Date(flow.created_at).toLocaleDateString()
    default: return ''
  }
}

export function formValuesToPayload(values: FlowFormValues): FlowPayload {
  return {
    hierarchy_values: values.hierarchy_values,
    name: values.name || null,
    contact: values.contact || null,
    src_connection_param: values.src_connection_param,
    dest_connection_param: values.dest_connection_param,
    src_template_id: values.src_template_id ? parseInt(values.src_template_id) : null,
    dest_template_id: values.dest_template_id ? parseInt(values.dest_template_id) : null,
    active: values.active,
    description: values.description || null,
  }
}

// Unused in utils but re-exported for convenience
export type { FlowColumn }
