'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">

            {/* Hierarchy values */}
            {hierarchy.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Hierarchy</p>
                {hierarchy.map(attr => (
                  <div key={attr.name} className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name={`hierarchy_values.${attr.name}.source` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Src {attr.label}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} disabled={viewOnly} placeholder={`Source ${attr.label}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`hierarchy_values.${attr.name}.destination` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Dest {attr.label}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} disabled={viewOnly} placeholder={`Destination ${attr.label}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* General fields */}
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
                      <Input {...field} disabled={viewOnly} placeholder="Contact person" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Connection params */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="src_connection_param"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Src Parameter Context</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={viewOnly} placeholder="Source param context" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dest_connection_param"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dest Parameter Context</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={viewOnly} placeholder="Destination param context" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Templates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="src_template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Src Template</FormLabel>
                    <Select
                      disabled={viewOnly}
                      value={field.value || NONE_VALUE}
                      onValueChange={val => field.onChange(val === NONE_VALUE ? '' : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source template" />
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
              <FormField
                control={form.control}
                name="dest_template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dest Template</FormLabel>
                    <Select
                      disabled={viewOnly}
                      value={field.value || NONE_VALUE}
                      onValueChange={val => field.onChange(val === NONE_VALUE ? '' : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select dest template" />
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

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      disabled={viewOnly}
                      placeholder="Optional description"
                      rows={3}
                    />
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
                <FormItem className="flex items-center gap-3">
                  <FormLabel className="mt-0">Active</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={viewOnly}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {!viewOnly && (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
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
