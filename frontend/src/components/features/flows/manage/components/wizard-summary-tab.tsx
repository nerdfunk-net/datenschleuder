'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ClipboardList, Info } from 'lucide-react'
import type { WizardFormReturn } from '../hooks/use-wizard-form'
import type { HierarchyAttribute } from '@/components/features/settings/nifi/types'

interface WizardSummaryTabProps {
  wizard: WizardFormReturn
  hierarchy: HierarchyAttribute[]
}

function SummaryField({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm text-slate-800 text-right max-w-[60%] truncate">{value || '—'}</span>
    </div>
  )
}

export function WizardSummaryTab({ wizard, hierarchy }: WizardSummaryTabProps) {
  const { state, credentials, registryFlows } = wizard

  // Resolve display names
  const srcCredentialName = useMemo(() => {
    if (!state.src_connection.credential_id) return null
    return credentials.find(c => c.id === state.src_connection.credential_id)?.name ?? null
  }, [state.src_connection.credential_id, credentials])

  const destCredentialName = useMemo(() => {
    if (!state.dest_connection.credential_id) return null
    return credentials.find(c => c.id === state.dest_connection.credential_id)?.name ?? null
  }, [state.dest_connection.credential_id, credentials])

  const srcTemplateName = useMemo(() => {
    if (!state.src_template_id) return null
    const rf = registryFlows.find(r => r.id.toString() === state.src_template_id)
    return rf ? `${rf.flow_name} (${rf.nifi_instance_name})` : null
  }, [state.src_template_id, registryFlows])

  const destTemplateName = useMemo(() => {
    if (!state.dest_template_id) return null
    const rf = registryFlows.find(r => r.id.toString() === state.dest_template_id)
    return rf ? `${rf.flow_name} (${rf.nifi_instance_name})` : null
  }, [state.dest_template_id, registryFlows])

  const newValuesCount = useMemo(() => {
    return Object.values(state.newHierarchyValues).reduce((sum, vals) => sum + vals.length, 0)
  }, [state.newHierarchyValues])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-400/80 to-purple-500/80 text-white py-3 px-4 rounded-lg flex items-center gap-2">
        <ClipboardList className="h-5 w-5" />
        <span className="font-medium">Review &amp; Create</span>
      </div>

      {/* General Section */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">General</h4>
        <SummaryField label="Name" value={state.name} />
        <SummaryField label="Contact" value={state.contact} />
        <SummaryField label="Description" value={state.description} />
        <SummaryField
          label="Status"
          value={
            <Badge className={state.active
              ? 'bg-green-100 text-green-800 border-green-300'
              : 'bg-red-100 text-red-800 border-red-300'
            }>
              {state.active ? 'Active' : 'Inactive'}
            </Badge>
          }
        />
      </div>

      {/* Source & Destination side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Source */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
          <h4 className="text-sm font-semibold text-blue-700 mb-3">Source</h4>
          {hierarchy.map(attr => (
            <SummaryField
              key={attr.name}
              label={attr.name}
              value={state.hierarchy_values[attr.name]?.source ?? ''}
            />
          ))}
          <SummaryField label="Server Name" value={state.src_connection.server_name} />
          <SummaryField label="Credentials" value={srcCredentialName ?? ''} />
          <SummaryField label="Parameter Context" value={state.src_connection.parameter_context} />
          <SummaryField label="Template" value={srcTemplateName ?? ''} />
        </div>

        {/* Destination */}
        <div className="rounded-lg border border-green-200 bg-green-50/30 p-4">
          <h4 className="text-sm font-semibold text-green-700 mb-3">Destination</h4>
          {hierarchy.map(attr => (
            <SummaryField
              key={attr.name}
              label={attr.name}
              value={state.hierarchy_values[attr.name]?.destination ?? ''}
            />
          ))}
          <SummaryField label="Server Name" value={state.dest_connection.server_name} />
          <SummaryField label="Credentials" value={destCredentialName ?? ''} />
          <SummaryField label="Parameter Context" value={state.dest_connection.parameter_context} />
          <SummaryField label="Template" value={destTemplateName ?? ''} />
        </div>
      </div>

      {/* New hierarchy values alert */}
      {newValuesCount > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {newValuesCount} new hierarchy value{newValuesCount !== 1 ? 's' : ''} will be saved along with this flow.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
