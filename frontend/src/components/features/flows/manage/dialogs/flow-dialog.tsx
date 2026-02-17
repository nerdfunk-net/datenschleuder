'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useNifiHierarchyValuesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import type { NifiFlow, RegistryFlow, FlowFormValues } from '../types'
import type { HierarchyAttribute } from '@/components/features/settings/nifi/types'

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

// ─── Combobox: dropdown of saved values + free-text input ─────────────────────

interface HierarchyComboboxProps {
  attributeName: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

function HierarchyCombobox({ attributeName, value, onChange, disabled }: HierarchyComboboxProps) {
  const { data } = useNifiHierarchyValuesQuery(attributeName)
  const savedValues = data?.values ?? []

  return (
    <div className="flex h-9">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-8 px-0 rounded-r-none border-r-0 shrink-0"
            disabled={disabled || savedValues.length === 0}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
          {savedValues.map(v => (
            <DropdownMenuItem key={v} onSelect={() => onChange(v)}>
              {v}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Select or type ${attributeName}`}
        disabled={disabled}
        className="rounded-l-none h-9 min-w-0"
      />
    </div>
  )
}

// ─── Section with hierarchy comboboxes + param context + template ──────────────

interface FlowSectionProps {
  side: 'source' | 'destination'
  hierarchy: HierarchyAttribute[]
  registryFlows: RegistryFlow[]
  viewOnly: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any
}

function FlowSection({ side, hierarchy, registryFlows, viewOnly, control }: FlowSectionProps) {
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
              name={`hierarchy_values.${attr.name}.${hierarchySide}` as any}
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
          name={paramField as any}
          rules={{ required: 'Required' }}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-xs font-semibold text-slate-600">
                {sectionLabel} Parameter Context
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={viewOnly}
                  placeholder="Enter parameter context"
                  className="h-9"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={templateField as any}
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
              control={form.control}
            />

            {/* DESTINATION */}
            <FlowSection
              side="destination"
              hierarchy={hierarchy}
              registryFlows={registryFlows}
              viewOnly={viewOnly}
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
