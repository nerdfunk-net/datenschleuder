'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { Path } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNifiClustersQuery } from '@/components/features/settings/nifi/hooks/use-nifi-clusters-query'
import { useParameterContextsQuery } from '../hooks/use-parameter-contexts-query'
import { HierarchyCombobox } from '../components/hierarchy-combobox'
import type { NifiFlow, RegistryFlow, FlowFormValues } from '../types'
import type { HierarchyAttribute, NifiCluster } from '@/components/features/settings/nifi/types'

const EMPTY_CLUSTERS: NifiCluster[] = []

interface FlowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flow: NifiFlow | null
  viewOnly?: boolean
  hierarchy: HierarchyAttribute[]
  registryFlows: RegistryFlow[]
  onSubmit: (values: FlowFormValues, id?: number) => void
  isSubmitting: boolean
}

const NONE_VALUE = '__none__'

function buildDefaultValues(
  flow: NifiFlow | null,
  hierarchy: HierarchyAttribute[],
): FlowFormValues {
  const hierarchyValues: Record<string, { source: string; destination: string }> = {}
  for (const attr of hierarchy) {
    hierarchyValues[attr.name] = {
      source: flow?.hierarchy_values?.[attr.name]?.source ?? '',
      destination: flow?.hierarchy_values?.[attr.name]?.destination ?? '',
    }
  }
  return {
    hierarchy_values: hierarchyValues,
    name: flow?.name ?? '',
    contact: flow?.contact ?? '',
    src_connection_param: flow?.src_connection_param ?? '',
    dest_connection_param: flow?.dest_connection_param ?? '',
    src_template_id: flow?.src_template_id?.toString() ?? '',
    dest_template_id: flow?.dest_template_id?.toString() ?? '',
    active: flow?.active ?? true,
    description: flow?.description ?? '',
  }
}

// ─── Parameter context select (fetches contexts from the matched NiFi instance) ─

interface ParameterContextSelectProps {
  instanceId: number | null
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  isInstanceLoading?: boolean
}

function ParameterContextSelect({ 
  instanceId, 
  value, 
  onChange, 
  disabled,
  isInstanceLoading = false 
}: ParameterContextSelectProps) {
  const { data, isFetching } = useParameterContextsQuery(instanceId)
  const contexts = data?.parameter_contexts ?? []

  if (!instanceId) {
    const placeholderText = isInstanceLoading 
      ? 'Loading instances...'
      : 'Select a hierarchy value first'
    
    return (
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholderText}
        disabled
        className="h-9"
      />
    )
  }

  return (
    <Select
      disabled={disabled || isFetching}
      value={value || NONE_VALUE}
      onValueChange={val => onChange(val === NONE_VALUE ? '' : val)}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder={isFetching ? 'Loading…' : '-- Select Parameter Context --'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>— None —</SelectItem>
        {contexts.map(ctx => (
          <SelectItem key={ctx.id} value={ctx.name}>
            {ctx.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── Section with hierarchy comboboxes + param context + template ──────────────

interface FlowSectionProps {
  side: 'source' | 'destination'
  hierarchy: HierarchyAttribute[]
  registryFlows: RegistryFlow[]
  viewOnly: boolean
  instanceId: number | null
  isInstanceLoading?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any
}

function FlowSection({ 
  side, 
  hierarchy, 
  registryFlows, 
  viewOnly, 
  instanceId, 
  isInstanceLoading = false,
  control 
}: FlowSectionProps) {
  const isSrc = side === 'source'
  const sectionLabel = isSrc ? 'Source' : 'Destination'
  const paramField = isSrc ? 'src_connection_param' : 'dest_connection_param'
  const templateField = isSrc ? 'src_template_id' : 'dest_template_id'
  const hierarchySide = isSrc ? 'source' : 'destination'

  const colorClasses = isSrc
    ? 'border-blue-100 bg-blue-50'
    : 'border-green-100 bg-green-50'
  const labelColor = isSrc ? 'text-blue-600' : 'text-green-700'

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${colorClasses}`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${labelColor}`}>
        {sectionLabel}
      </p>

      {/* Hierarchy fields — one column per attribute */}
      {hierarchy.length > 0 && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${hierarchy.length}, minmax(0, 1fr))` }}
        >
          {hierarchy.map(attr => (
            <FormField
              key={attr.name}
              control={control}
              name={`hierarchy_values.${attr.name}.${hierarchySide}` as Path<FlowFormValues>}
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-semibold text-slate-600">
                    {attr.name}
                  </FormLabel>
                  <FormControl>
                    <HierarchyCombobox
                      attributeName={attr.name}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={viewOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      )}

      {/* Parameter context + template */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={paramField as Path<FlowFormValues>}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs font-semibold text-slate-600">
                {sectionLabel} Parameter Context
              </FormLabel>
              <FormControl>
                <ParameterContextSelect
                  instanceId={instanceId}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={viewOnly}
                  isInstanceLoading={isInstanceLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={templateField as Path<FlowFormValues>}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs font-semibold text-slate-600">
                Template
              </FormLabel>
              <Select
                disabled={viewOnly}
                value={field.value || NONE_VALUE}
                onValueChange={val => field.onChange(val === NONE_VALUE ? '' : val)}
              >
                <FormControl>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="-- Select Template --" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— None —</SelectItem>
                  {registryFlows.map(rf => (
                    <SelectItem key={rf.id} value={rf.id.toString()}>
                      {rf.flow_name} ({rf.nifi_instance_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}

// ─── Dialog ────────────────────────────────────────────────────────────────────

export function FlowDialog({
  open,
  onOpenChange,
  flow,
  viewOnly = false,
  hierarchy,
  registryFlows,
  onSubmit,
  isSubmitting,
}: FlowDialogProps) {
  const form = useForm<FlowFormValues>({
    defaultValues: buildDefaultValues(flow, hierarchy),
  })

  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues(flow, hierarchy))
    }
  }, [open, flow, hierarchy, form])

  // Derive instance IDs by checking the FIRST (top) hierarchy attribute only via cluster primary member
  const { data: clusters = EMPTY_CLUSTERS } = useNifiClustersQuery()

  // Use useWatch instead of form.watch for better reactivity with nested fields
  const hierarchyValues = useWatch({
    control: form.control,
    name: 'hierarchy_values',
  })

  // Debug: Log form value changes
  useEffect(() => {
    const topAttr = hierarchy[0]
    if (!topAttr) return
    
    console.log('[FlowDialog] Form values changed:', {
      hierarchyValues,
      topAttrName: topAttr.name,
      srcValue: hierarchyValues?.[topAttr.name]?.source,
      destValue: hierarchyValues?.[topAttr.name]?.destination,
    })
  }, [hierarchyValues, hierarchy])

  // Compute instance ID for source via cluster primary member
  const srcInstanceId = useMemo(() => {
    if (!hierarchyValues || !clusters.length || !hierarchy.length) return null
    const topAttr = hierarchy[0]
    if (!topAttr) return null
    const srcValue = hierarchyValues[topAttr.name]?.source
    if (!srcValue) return null
    const cluster = clusters.find(
      c => c.hierarchy_attribute === topAttr.name && c.hierarchy_value === srcValue
    )
    return cluster?.members.find(m => m.is_primary)?.instance_id ?? null
  }, [hierarchyValues, clusters, hierarchy])

  // Compute instance ID for destination via cluster primary member
  const destInstanceId = useMemo(() => {
    if (!hierarchyValues || !clusters.length || !hierarchy.length) return null
    const topAttr = hierarchy[0]
    if (!topAttr) return null
    const destValue = hierarchyValues[topAttr.name]?.destination
    if (!destValue) return null
    const cluster = clusters.find(
      c => c.hierarchy_attribute === topAttr.name && c.hierarchy_value === destValue
    )
    return cluster?.members.find(m => m.is_primary)?.instance_id ?? null
  }, [hierarchyValues, clusters, hierarchy])

  function handleSubmit(values: FlowFormValues) {
    onSubmit(values, flow?.id)
  }

  const title = viewOnly ? 'View Flow' : flow ? 'Edit Flow' : 'Add New Flow'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

            {/* SOURCE */}
            <FlowSection
              side="source"
              hierarchy={hierarchy}
              registryFlows={registryFlows}
              viewOnly={viewOnly}
              instanceId={srcInstanceId}
              isInstanceLoading={false}
              control={form.control}
            />

            {/* DESTINATION */}
            <FlowSection
              side="destination"
              hierarchy={hierarchy}
              registryFlows={registryFlows}
              viewOnly={viewOnly}
              instanceId={destInstanceId}
              isInstanceLoading={false}
              control={form.control}
            />

            {/* Name + Contact */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={viewOnly} placeholder="Flow name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={viewOnly} placeholder="Contact information" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={viewOnly} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={viewOnly}
                    />
                  </FormControl>
                  <FormLabel className="mt-0 cursor-pointer font-normal">Active</FormLabel>
                </FormItem>
              )}
            />

            {!viewOnly && (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? 'Saving…' : flow ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            )}

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
