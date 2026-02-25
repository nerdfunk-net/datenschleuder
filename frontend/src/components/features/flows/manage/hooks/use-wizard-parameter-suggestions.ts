'use client'

import { useMemo } from 'react'
import { useRegistryFlowMetadataQuery } from '@/components/features/settings/registry/hooks/use-registry-flow-metadata-query'
import {
  useParameterContextsListQuery,
  useParameterContextDetailQuery,
} from '@/components/features/nifi/parameters/hooks/use-parameter-contexts-query'
import type { WizardFormReturn } from './use-wizard-form'
import type { ParameterEntity } from '@/components/features/nifi/parameters/types'

// ── Shared key sets (also imported by wizard-connection-tab) ─────────────────
export const SERVER_NAME_KEYS = new Set(['servername', 'server_name', 'hostname', 'host_name'])
export const USERNAME_KEYS = new Set(['username', 'user_name'])
export const SSH_KEY_FILE_KEYS = new Set(['ssh_key_file', 'ssh_keyfile'])

// ── Types ────────────────────────────────────────────────────────────────────
export interface ParameterSuggestion {
  key: string
  value: string
  sensitive: boolean
}

export interface SideSuggestions {
  instanceId: number
  contextId: string
  contextName: string
  suggestions: ParameterSuggestion[]
  /** Full existing parameter list needed for the merged PUT payload */
  existingParams: ParameterEntity[]
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useWizardParameterSuggestions(wizard: WizardFormReturn) {
  // ── Source queries (TanStack cache: no extra network calls if tab was visited) ──
  const srcTemplateIdNum = wizard.state.src_template_id
    ? parseInt(wizard.state.src_template_id)
    : null
  const { data: srcMetadata } = useRegistryFlowMetadataQuery(srcTemplateIdNum)
  const { data: srcContextsList } = useParameterContextsListQuery(wizard.srcInstanceId)

  const srcContextId = useMemo(
    () =>
      srcContextsList?.parameter_contexts.find(
        c => c.name === wizard.state.src_connection.parameter_context,
      )?.id ?? null,
    [srcContextsList, wizard.state.src_connection.parameter_context],
  )

  const { data: srcContextDetail } = useParameterContextDetailQuery(
    wizard.srcInstanceId,
    srcContextId,
  )

  // ── Destination queries ───────────────────────────────────────────────────
  const destTemplateIdNum = wizard.state.dest_template_id
    ? parseInt(wizard.state.dest_template_id)
    : null
  const { data: destMetadata } = useRegistryFlowMetadataQuery(destTemplateIdNum)
  const { data: destContextsList } = useParameterContextsListQuery(wizard.destInstanceId)

  const destContextId = useMemo(
    () =>
      destContextsList?.parameter_contexts.find(
        c => c.name === wizard.state.dest_connection.parameter_context,
      )?.id ?? null,
    [destContextsList, wizard.state.dest_connection.parameter_context],
  )

  const { data: destContextDetail } = useParameterContextDetailQuery(
    wizard.destInstanceId,
    destContextId,
  )

  // ── Source suggestions ────────────────────────────────────────────────────
  const srcSuggestions = useMemo((): SideSuggestions | null => {
    if (!srcMetadata || !srcContextDetail || !wizard.srcInstanceId || !srcContextId) return null

    const credential =
      wizard.credentials.find(c => c.id === wizard.state.src_connection.credential_id) ?? null
    const contextParamMap = new Map(
      srcContextDetail.parameter_context.parameters.map(p => [p.name, p]),
    )

    const suggestions: ParameterSuggestion[] = []
    for (const item of srcMetadata) {
      if (!item.is_mandatory) continue
      const existing = contextParamMap.get(item.key)
      if (existing?.value) continue // already configured

      let value: string | null = null
      if (SERVER_NAME_KEYS.has(item.key)) value = wizard.state.src_connection.server_name || null
      else if (USERNAME_KEYS.has(item.key)) value = credential?.username ?? null
      else if (SSH_KEY_FILE_KEYS.has(item.key)) value = credential?.ssh_keyfile_path ?? null

      if (value) suggestions.push({ key: item.key, value, sensitive: false })
    }

    if (suggestions.length === 0) return null
    return {
      instanceId: wizard.srcInstanceId,
      contextId: srcContextId,
      contextName: wizard.state.src_connection.parameter_context,
      suggestions,
      existingParams: srcContextDetail.parameter_context.parameters,
    }
  }, [
    srcMetadata,
    srcContextDetail,
    wizard.srcInstanceId,
    srcContextId,
    wizard.state.src_connection,
    wizard.credentials,
  ])

  // ── Destination suggestions ───────────────────────────────────────────────
  const destSuggestions = useMemo((): SideSuggestions | null => {
    if (!destMetadata || !destContextDetail || !wizard.destInstanceId || !destContextId) return null

    const credential =
      wizard.credentials.find(c => c.id === wizard.state.dest_connection.credential_id) ?? null
    const contextParamMap = new Map(
      destContextDetail.parameter_context.parameters.map(p => [p.name, p]),
    )

    const suggestions: ParameterSuggestion[] = []
    for (const item of destMetadata) {
      if (!item.is_mandatory) continue
      const existing = contextParamMap.get(item.key)
      if (existing?.value) continue

      let value: string | null = null
      if (SERVER_NAME_KEYS.has(item.key)) value = wizard.state.dest_connection.server_name || null
      else if (USERNAME_KEYS.has(item.key)) value = credential?.username ?? null
      else if (SSH_KEY_FILE_KEYS.has(item.key)) value = credential?.ssh_keyfile_path ?? null

      if (value) suggestions.push({ key: item.key, value, sensitive: false })
    }

    if (suggestions.length === 0) return null
    return {
      instanceId: wizard.destInstanceId,
      contextId: destContextId,
      contextName: wizard.state.dest_connection.parameter_context,
      suggestions,
      existingParams: destContextDetail.parameter_context.parameters,
    }
  }, [
    destMetadata,
    destContextDetail,
    wizard.destInstanceId,
    destContextId,
    wizard.state.dest_connection,
    wizard.credentials,
  ])

  return useMemo(
    () => ({
      srcSuggestions,
      destSuggestions,
      hasSuggestions: srcSuggestions !== null || destSuggestions !== null,
    }),
    [srcSuggestions, destSuggestions],
  )
}
