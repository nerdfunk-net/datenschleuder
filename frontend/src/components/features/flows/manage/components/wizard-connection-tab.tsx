'use client'

import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Layers, Network, Workflow, ShieldCheck, CheckCircle2, XCircle, Loader2, ArrowUpFromLine } from 'lucide-react'
import { HierarchyCombobox } from './hierarchy-combobox'
import { ParameterContextDialog } from '@/components/features/nifi/parameters/components/parameter-context-dialog'
import { useParameterContextsListQuery, useParameterContextDetailQuery } from '@/components/features/nifi/parameters/hooks/use-parameter-contexts-query'
import { useParameterContextMutations } from '@/components/features/nifi/parameters/hooks/use-parameter-contexts-mutations'
import { useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import { useRegistryFlowMetadataQuery } from '@/components/features/settings/registry/hooks/use-registry-flow-metadata-query'
import type { WizardFormReturn } from '../hooks/use-wizard-form'
import type { HierarchyAttribute } from '@/components/features/settings/nifi/types'
import type { ParameterContextForm, ParameterContext } from '@/components/features/nifi/parameters/types'

import {
  SERVER_NAME_KEYS,
  USERNAME_KEYS,
  SSH_KEY_FILE_KEYS,
} from '../hooks/use-wizard-parameter-suggestions'

const NONE_VALUE = '__none__'
const CREATE_NEW_VALUE = '__create_new__'
const EMPTY_CONTEXTS: ParameterContext[] = []

const INITIAL_PC_FORM: ParameterContextForm = {
  instance_id: null,
  context_id: null,
  name: '',
  description: '',
  parameters: [],
  inherited_parameter_contexts: [],
}

interface WizardConnectionTabProps {
  side: 'source' | 'destination'
  hierarchy: HierarchyAttribute[]
  wizard: WizardFormReturn
}

export function WizardConnectionTab({ side, hierarchy, wizard }: WizardConnectionTabProps) {
  const isSrc = side === 'source'
  const sideKey = isSrc ? 'src' : 'dest'
  const sectionLabel = isSrc ? 'Source' : 'Destination'
  const instanceId = isSrc ? wizard.srcInstanceId : wizard.destInstanceId
  const connection = isSrc ? wizard.state.src_connection : wizard.state.dest_connection
  const templateId = isSrc ? wizard.state.src_template_id : wizard.state.dest_template_id
  const templates = isSrc ? wizard.filteredSrcTemplates : wizard.filteredDestTemplates

  const colorFrom = 'from-blue-400/80'
  const colorTo = 'to-blue-500/80'

  // ── Parameter contexts list (for selection) ──────────────────────────────────
  const { data: pcData } = useParameterContextsListQuery(instanceId)
  const contexts = pcData?.parameter_contexts ?? EMPTY_CONTEXTS

  // ── Parameter context dialog state ───────────────────────────────────────────
  const [pcDialogOpen, setPcDialogOpen] = useState(false)
  const [pcForm, setPcForm] = useState<ParameterContextForm>({
    ...INITIAL_PC_FORM,
    instance_id: instanceId,
  })

  const { data: instances } = useNifiInstancesQuery()
  const instancesList = instances ?? []

  const { createContext } = useParameterContextMutations()

  // ── Verification data ─────────────────────────────────────────────────────────
  const templateIdNum = templateId ? parseInt(templateId) : null
  const { data: metadataItems, isLoading: metadataLoading } = useRegistryFlowMetadataQuery(templateIdNum)

  // Resolve the selected parameter context UUID from the name stored in wizard state
  const selectedContextId = useMemo(
    () => contexts.find(c => c.name === connection.parameter_context)?.id ?? null,
    [contexts, connection.parameter_context],
  )

  const { data: contextDetailData, isLoading: contextDetailLoading } = useParameterContextDetailQuery(
    instanceId,
    selectedContextId,
  )

  const showVerification = !!templateId && !!connection.parameter_context && instanceId !== null

  // Build verification rows: each metadata item + whether it was found in the context
  const verificationRows = useMemo(() => {
    if (!metadataItems || !contextDetailData) return null
    const contextParamMap = new Map(
      contextDetailData.parameter_context.parameters.map(p => [p.name, p]),
    )
    return metadataItems.map(item => {
      const ctxParam = contextParamMap.get(item.key)
      return {
        key: item.key,
        defaultValue: item.value,
        contextValue: ctxParam?.value ?? null,
        isMandatory: item.is_mandatory,
        found: contextParamMap.has(item.key),
      }
    })
  }, [metadataItems, contextDetailData])

  const mandatoryRows = useMemo(() => verificationRows?.filter(r => r.isMandatory) ?? [], [verificationRows])
  const optionalRows = useMemo(() => verificationRows?.filter(r => !r.isMandatory) ?? [], [verificationRows])

  const selectedCredential = useMemo(
    () => wizard.credentials.find(c => c.id === connection.credential_id) ?? null,
    [wizard.credentials, connection.credential_id],
  )

  const missingMandatoryCount = mandatoryRows.filter(r => !r.found).length
  const allMandatoryOk = mandatoryRows.length > 0 && missingMandatoryCount === 0

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleHierarchyChange = useCallback(
    (attr: string, value: string) => {
      wizard.setHierarchyValue(attr, isSrc ? 'source' : 'destination', value)
    },
    [wizard, isSrc],
  )

  const handleServerNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      wizard.setConnectionField(sideKey as 'src' | 'dest', 'server_name', e.target.value)
    },
    [wizard, sideKey],
  )

  const handleCredentialChange = useCallback(
    (val: string) => {
      wizard.setConnectionField(
        sideKey as 'src' | 'dest',
        'credential_id',
        val === NONE_VALUE ? null : parseInt(val),
      )
    },
    [wizard, sideKey],
  )

  const handleParameterContextChange = useCallback(
    (val: string) => {
      if (val === CREATE_NEW_VALUE) {
        setPcForm({ ...INITIAL_PC_FORM, instance_id: instanceId })
        setPcDialogOpen(true)
        return
      }
      wizard.setConnectionField(
        sideKey as 'src' | 'dest',
        'parameter_context',
        val === NONE_VALUE ? '' : val,
      )
    },
    [wizard, sideKey, instanceId],
  )

  const handleTemplateChange = useCallback(
    (val: string) => {
      wizard.setField(isSrc ? 'src_template_id' : 'dest_template_id', val === NONE_VALUE ? '' : val)
    },
    [wizard, isSrc],
  )

  const handlePcSave = useCallback(() => {
    if (!pcForm.instance_id || !pcForm.name) return
    createContext.mutate(
      {
        instanceId: pcForm.instance_id,
        name: pcForm.name,
        description: pcForm.description || undefined,
        parameters: pcForm.parameters
          .filter(p => p.isLocal)
          .map(p => ({
            name: p.name,
            description: p.description,
            sensitive: p.sensitive,
            value: p.value,
          })),
      },
      {
        onSuccess: () => {
          setPcDialogOpen(false)
          wizard.setConnectionField(sideKey as 'src' | 'dest', 'parameter_context', pcForm.name)
        },
      },
    )
  }, [pcForm, createContext, wizard, sideKey])

  const allContextsForInstance = useMemo(() => contexts, [contexts])

  // For ≤ 4 hierarchy attrs: put all in one row with compact columns
  const hierarchyGridStyle =
    hierarchy.length <= 4
      ? { gridTemplateColumns: `repeat(${hierarchy.length}, minmax(0, auto))` }
      : { gridTemplateColumns: `repeat(3, minmax(0, 1fr))` }

  return (
    <div className="space-y-4">
      {/* ── Hierarchy ──────────────────────────────────────────── */}
      {hierarchy.length > 0 && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className={`bg-gradient-to-r ${colorFrom} ${colorTo} text-white py-2 px-4 flex items-center gap-2 rounded-t-lg`}>
            <Layers className="h-4 w-4" />
            <span className="text-sm font-medium">Hierarchy</span>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div className="grid gap-4" style={hierarchyGridStyle}>
              {hierarchy.map(attr => (
                <div key={attr.name} className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{attr.label}</Label>
                  <HierarchyCombobox
                    attributeName={attr.name}
                    value={wizard.state.hierarchy_values[attr.name]?.[isSrc ? 'source' : 'destination'] ?? ''}
                    onChange={val => handleHierarchyChange(attr.name, val)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Connection ─────────────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className={`bg-gradient-to-r ${colorFrom} ${colorTo} text-white py-2 px-4 flex items-center gap-2 rounded-t-lg`}>
          <Network className="h-4 w-4" />
          <span className="text-sm font-medium">Connection</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Server Name</Label>
              <Input
                value={connection.server_name}
                onChange={handleServerNameChange}
                placeholder="e.g., my-server.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Credentials</Label>
              <Select
                value={connection.credential_id?.toString() ?? NONE_VALUE}
                onValueChange={handleCredentialChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="-- Select Credentials --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>-- None --</SelectItem>
                  {wizard.credentials.map(cred => (
                    <SelectItem key={cred.id} value={cred.id.toString()}>
                      {cred.name} ({cred.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── NiFi Integration ───────────────────────────────────── */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className={`bg-gradient-to-r ${colorFrom} ${colorTo} text-white py-2 px-4 flex items-center gap-2 rounded-t-lg`}>
          <Workflow className="h-4 w-4" />
          <span className="text-sm font-medium">NiFi Integration</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="grid grid-cols-2 gap-4">
            {/* Template — first */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Template</Label>
              <Select
                value={templateId || NONE_VALUE}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="-- Select Template --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>-- None --</SelectItem>
                  {templates.map(rf => (
                    <SelectItem key={rf.id} value={rf.id.toString()}>
                      {rf.flow_name} ({rf.nifi_instance_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parameter Context — second */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Parameter Context</Label>
              {!instanceId ? (
                <Input
                  disabled
                  placeholder="Select a hierarchy value first"
                  className="h-9"
                />
              ) : (
                <Select
                  value={connection.parameter_context || NONE_VALUE}
                  onValueChange={handleParameterContextChange}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="-- Select Parameter Context --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>-- None --</SelectItem>
                    {contexts.map(ctx => (
                      <SelectItem key={ctx.id} value={ctx.name}>
                        {ctx.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={CREATE_NEW_VALUE}>+ Create New</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Verification ───────────────────────────────────────── */}
      {showVerification && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          {/* Header with dynamic status summary */}
          <div className={`bg-gradient-to-r ${colorFrom} ${colorTo} text-white py-2 px-4 flex items-center justify-between rounded-t-lg`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-medium">{sectionLabel} Verification</span>
            </div>
            {verificationRows && !metadataLoading && !contextDetailLoading && (
              <span className="text-xs text-blue-100">
                {missingMandatoryCount === 0
                  ? `${mandatoryRows.length} mandatory, ${optionalRows.length} optional`
                  : `${missingMandatoryCount} mandatory parameter${missingMandatoryCount !== 1 ? 's' : ''} missing`}
              </span>
            )}
          </div>

          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            {/* Loading state */}
            {(metadataLoading || contextDetailLoading) && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Checking parameters…</span>
              </div>
            )}

            {/* No metadata defined */}
            {!metadataLoading && !contextDetailLoading && metadataItems && metadataItems.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No parameters defined for this template.
              </p>
            )}

            {/* Verification table */}
            {!metadataLoading && !contextDetailLoading && verificationRows && verificationRows.length > 0 && (
              <div className="space-y-4">

                {/* Overall status banner */}
                {allMandatoryOk ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    All mandatory parameters are configured in the selected Parameter Context.
                  </div>
                ) : missingMandatoryCount > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                    <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    {missingMandatoryCount} mandatory parameter{missingMandatoryCount !== 1 ? 's are' : ' is'} missing from the selected Parameter Context.
                  </div>
                ) : null}

                {/* Mandatory Parameters */}
                {mandatoryRows.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Mandatory Parameters
                    </h5>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide w-1/4">Key</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide w-1/4">Default Value</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide w-1/4">Parameter Value</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mandatoryRows.map(row => (
                            <TableRow
                              key={row.key}
                              className={row.found ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}
                            >
                              <TableCell className={`font-mono text-sm font-medium ${row.found ? 'text-green-900' : 'text-red-900'}`}>
                                {row.key}
                              </TableCell>
                              <TableCell className={`text-sm ${row.found ? 'text-green-800' : 'text-red-800'}`}>
                                {row.defaultValue || <span className="text-slate-400 italic">—</span>}
                              </TableCell>
                              <TableCell className={`text-sm ${row.found ? 'text-green-800' : 'text-red-800'}`}>
                                {SERVER_NAME_KEYS.has(row.key) && !row.contextValue ? (
                                  <div className="space-y-1">
                                    <Input
                                      className="h-7 text-sm border-blue-300 bg-blue-50 focus-visible:ring-blue-400"
                                      value={connection.server_name}
                                      onChange={e => wizard.setConnectionField(sideKey as 'src' | 'dest', 'server_name', e.target.value)}
                                      placeholder="Enter server name"
                                    />
                                    <p className="flex items-center gap-1 text-xs text-blue-500">
                                      <ArrowUpFromLine className="h-3 w-3 shrink-0" />
                                      Pre-filled from Connection panel
                                    </p>
                                  </div>
                                ) : USERNAME_KEYS.has(row.key) && !row.contextValue && selectedCredential ? (
                                  <div className="space-y-1">
                                    <Input
                                      readOnly
                                      className="h-7 text-sm border-blue-300 bg-blue-50"
                                      value={selectedCredential.username}
                                    />
                                    <p className="flex items-center gap-1 text-xs text-blue-500">
                                      <ArrowUpFromLine className="h-3 w-3 shrink-0" />
                                      From selected credential
                                    </p>
                                  </div>
                                ) : SSH_KEY_FILE_KEYS.has(row.key) && !row.contextValue && selectedCredential?.ssh_keyfile_path ? (
                                  <div className="space-y-1">
                                    <Input
                                      readOnly
                                      className="h-7 text-sm border-blue-300 bg-blue-50 font-mono"
                                      value={selectedCredential.ssh_keyfile_path}
                                    />
                                    <p className="flex items-center gap-1 text-xs text-blue-500">
                                      <ArrowUpFromLine className="h-3 w-3 shrink-0" />
                                      From selected credential
                                    </p>
                                  </div>
                                ) : (
                                  row.contextValue ?? <span className="text-slate-400 italic">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.found ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Found
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 border-red-300 gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Missing
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Optional Parameters */}
                {optionalRows.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Optional Parameters
                    </h5>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide w-1/4">Key</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide w-1/4">Default Value</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide w-1/4">Parameter Value</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {optionalRows.map(row => (
                            <TableRow
                              key={row.key}
                              className={row.found ? 'bg-green-50 hover:bg-green-100' : 'bg-amber-50 hover:bg-amber-100'}
                            >
                              <TableCell className={`font-mono text-sm font-medium ${row.found ? 'text-green-900' : 'text-amber-900'}`}>
                                {row.key}
                              </TableCell>
                              <TableCell className={`text-sm ${row.found ? 'text-green-800' : 'text-amber-800'}`}>
                                {row.defaultValue || <span className="text-slate-400 italic">—</span>}
                              </TableCell>
                              <TableCell className={`text-sm ${row.found ? 'text-green-800' : 'text-amber-800'}`}>
                                {row.contextValue ?? <span className="text-slate-400 italic">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.found ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Found
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Missing
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* Parameter Context Create Dialog */}
      <ParameterContextDialog
        open={pcDialogOpen}
        onOpenChange={setPcDialogOpen}
        mode="create"
        form={pcForm}
        onFormChange={setPcForm}
        instances={instancesList}
        allContextsForInstance={allContextsForInstance}
        isSaving={createContext.isPending}
        onSave={handlePcSave}
      />
    </div>
  )
}
