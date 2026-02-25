'use client'

import { useState, useMemo, useCallback } from 'react'
import { useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import { useRegistryFlowsQuery } from './use-flows-query'
import { useCredentialsQuery } from '@/components/features/settings/credentials/hooks/queries/use-credentials-query'
import type { HierarchyAttribute, NifiInstance } from '@/components/features/settings/nifi/types'
import type { FlowPayload } from './use-flows-mutations'
import type { RegistryFlow } from '../types'
import type { Credential } from '@/components/features/settings/credentials/types'

export type WizardTab = 'general' | 'source' | 'destination' | 'summary'

const TAB_ORDER: WizardTab[] = ['general', 'source', 'destination', 'summary']

export interface WizardConnectionParams {
  server_name: string
  credential_id: number | null
  parameter_context: string
}

export interface WizardFormState {
  name: string
  contact: string
  description: string
  active: boolean
  hierarchy_values: Record<string, { source: string; destination: string }>
  src_connection: WizardConnectionParams
  src_template_id: string
  dest_connection: WizardConnectionParams
  dest_template_id: string
  currentTab: WizardTab
  newHierarchyValues: Record<string, string[]>
}

const EMPTY_CONNECTION: WizardConnectionParams = {
  server_name: '',
  credential_id: null,
  parameter_context: '',
}

const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_REGISTRY_FLOWS: RegistryFlow[] = []
const EMPTY_CREDENTIALS: Credential[] = []

function buildInitialState(hierarchy: HierarchyAttribute[]): WizardFormState {
  const hierarchyValues: Record<string, { source: string; destination: string }> = {}
  for (const attr of hierarchy) {
    hierarchyValues[attr.name] = { source: '', destination: '' }
  }
  return {
    name: '',
    contact: '',
    description: '',
    active: true,
    hierarchy_values: hierarchyValues,
    src_connection: { ...EMPTY_CONNECTION },
    src_template_id: '',
    dest_connection: { ...EMPTY_CONNECTION },
    dest_template_id: '',
    currentTab: 'general',
    newHierarchyValues: {},
  }
}

export function useWizardForm(hierarchy: HierarchyAttribute[]) {
  const [state, setState] = useState<WizardFormState>(() => buildInitialState(hierarchy))

  // Queries
  const { data: instances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const { data: registryFlows = EMPTY_REGISTRY_FLOWS } = useRegistryFlowsQuery()
  const { data: credentials = EMPTY_CREDENTIALS } = useCredentialsQuery()

  // Resolve instance IDs from first hierarchy attribute
  const srcInstanceId = useMemo(() => {
    if (!instances.length || !hierarchy.length) return null
    const topAttr = hierarchy[0]
    if (!topAttr) return null
    const srcValue = state.hierarchy_values[topAttr.name]?.source
    if (!srcValue) return null
    const instance = instances.find(
      i => i.hierarchy_attribute === topAttr.name && i.hierarchy_value === srcValue
    )
    return instance?.id ?? null
  }, [state.hierarchy_values, instances, hierarchy])

  const destInstanceId = useMemo(() => {
    if (!instances.length || !hierarchy.length) return null
    const topAttr = hierarchy[0]
    if (!topAttr) return null
    const destValue = state.hierarchy_values[topAttr.name]?.destination
    if (!destValue) return null
    const instance = instances.find(
      i => i.hierarchy_attribute === topAttr.name && i.hierarchy_value === destValue
    )
    return instance?.id ?? null
  }, [state.hierarchy_values, instances, hierarchy])

  // Filter templates by resolved instance
  const filteredSrcTemplates = useMemo(() => {
    if (!srcInstanceId) return registryFlows
    return registryFlows.filter(rf => rf.nifi_instance_id === srcInstanceId)
  }, [registryFlows, srcInstanceId])

  const filteredDestTemplates = useMemo(() => {
    if (!destInstanceId) return registryFlows
    return registryFlows.filter(rf => rf.nifi_instance_id === destInstanceId)
  }, [registryFlows, destInstanceId])

  // Setters
  const setField = useCallback(<K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const setHierarchyValue = useCallback((attr: string, side: 'source' | 'destination', value: string) => {
    setState(prev => {
      const current = prev.hierarchy_values[attr] ?? { source: '', destination: '' }
      return {
        ...prev,
        hierarchy_values: {
          ...prev.hierarchy_values,
          [attr]: {
            source: current.source,
            destination: current.destination,
            [side]: value,
          },
        },
      }
    })
  }, [])

  const trackNewHierarchyValue = useCallback((attr: string, value: string) => {
    setState(prev => {
      const existing = prev.newHierarchyValues[attr] ?? []
      if (existing.includes(value)) return prev
      return {
        ...prev,
        newHierarchyValues: {
          ...prev.newHierarchyValues,
          [attr]: [...existing, value],
        },
      }
    })
  }, [])

  const setConnectionField = useCallback(
    (side: 'src' | 'dest', field: keyof WizardConnectionParams, value: string | number | null) => {
      const key = side === 'src' ? 'src_connection' : 'dest_connection'
      setState(prev => ({
        ...prev,
        [key]: { ...prev[key], [field]: value },
      }))
    },
    [],
  )

  // Navigation
  const setTab = useCallback((tab: WizardTab) => {
    setState(prev => ({ ...prev, currentTab: tab }))
  }, [])

  const goNext = useCallback(() => {
    setState(prev => {
      const idx = TAB_ORDER.indexOf(prev.currentTab)
      const next = TAB_ORDER[idx + 1]
      if (next) {
        return { ...prev, currentTab: next }
      }
      return prev
    })
  }, [])

  const goPrev = useCallback(() => {
    setState(prev => {
      const idx = TAB_ORDER.indexOf(prev.currentTab)
      const previous = TAB_ORDER[idx - 1]
      if (previous) {
        return { ...prev, currentTab: previous }
      }
      return prev
    })
  }, [])

  // Build payload for API
  const buildPayload = useCallback((): FlowPayload => {
    return {
      hierarchy_values: state.hierarchy_values,
      name: state.name || null,
      contact: state.contact || null,
      src_connection_param: JSON.stringify({
        server_name: state.src_connection.server_name,
        credential_id: state.src_connection.credential_id,
        parameter_context: state.src_connection.parameter_context,
      }),
      dest_connection_param: JSON.stringify({
        server_name: state.dest_connection.server_name,
        credential_id: state.dest_connection.credential_id,
        parameter_context: state.dest_connection.parameter_context,
      }),
      src_template_id: state.src_template_id ? parseInt(state.src_template_id) : null,
      dest_template_id: state.dest_template_id ? parseInt(state.dest_template_id) : null,
      active: state.active,
      description: state.description || null,
    }
  }, [state])

  const reset = useCallback(() => {
    setState(buildInitialState(hierarchy))
  }, [hierarchy])

  return useMemo(() => ({
    state,
    setField,
    setHierarchyValue,
    trackNewHierarchyValue,
    setConnectionField,
    setTab,
    goNext,
    goPrev,
    srcInstanceId,
    destInstanceId,
    filteredSrcTemplates,
    filteredDestTemplates,
    credentials,
    registryFlows,
    buildPayload,
    reset,
  }), [
    state,
    setField,
    setHierarchyValue,
    trackNewHierarchyValue,
    setConnectionField,
    setTab,
    goNext,
    goPrev,
    srcInstanceId,
    destInstanceId,
    filteredSrcTemplates,
    filteredDestTemplates,
    credentials,
    registryFlows,
    buildPayload,
    reset,
  ])
}

export type WizardFormReturn = ReturnType<typeof useWizardForm>
