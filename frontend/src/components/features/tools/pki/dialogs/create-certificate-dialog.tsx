'use client'

import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CreateCertificateRequest } from '../types'

const X509_KEYS = ['CN', 'O', 'OU', 'C', 'ST', 'L', 'emailAddress'] as const
type X509Key = typeof X509_KEYS[number]

const X509_LABELS: Record<X509Key, string> = {
  CN: 'CN – Common Name',
  O: 'O – Organization',
  OU: 'OU – Org Unit',
  C: 'C – Country',
  ST: 'ST – State',
  L: 'L – Locality',
  emailAddress: 'emailAddress',
}

const attributeSchema = z.object({
  key: z.enum(X509_KEYS),
  value: z.string().min(1, 'Required'),
}).refine(attr => !(attr.key === 'C' && attr.value.length > 2), {
  message: 'Max 2 chars',
  path: ['value'],
})

const schema = z.object({
  attributes: z.array(attributeSchema)
    .min(1, 'Add at least one attribute')
    .refine(attrs => attrs.some(a => a.key === 'CN' && a.value.trim().length > 0), {
      message: 'CN (Common Name) is required',
    }),
  cert_type: z.enum(['server', 'client', 'user', 'server+client']),
  validity_days: z.string().min(1),
  key_size: z.enum(['2048', '4096']),
  san_dns: z.string().optional(),
  san_ip: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateCertificateRequest) => void
  isPending: boolean
}

function DNPreview({ control }: { control: ReturnType<typeof useForm<FormValues>>['control'] }) {
  const attributes = useWatch({ control, name: 'attributes' })
  const dnString = attributes
    .filter(a => a.value?.trim())
    .map(a => `${a.key}=${a.value.trim()}`)
    .join(', ')

  return (
    <div className="rounded-md bg-muted px-3 py-2 min-h-[3rem]">
      <p className="text-xs text-muted-foreground mb-1">Subject DN</p>
      <code className="text-sm font-mono break-all">
        {dnString || <span className="text-muted-foreground italic">No attributes yet</span>}
      </code>
    </div>
  )
}

export function CreateCertificateDialog({ open, onOpenChange, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      attributes: [{ key: 'CN', value: '' }],
      cert_type: 'server',
      validity_days: '365',
      key_size: '2048',
      san_dns: '',
      san_ip: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'attributes',
  })

  const watchedAttributes = useWatch({ control: form.control, name: 'attributes' })

  const handleSubmit = (values: FormValues) => {
    const getFirst = (key: X509Key) => values.attributes.find(a => a.key === key)?.value || undefined
    const getAll   = (key: X509Key) => values.attributes.filter(a => a.key === key).map(a => a.value)

    const orgs = getAll('O')
    const ous  = getAll('OU')

    onSubmit({
      common_name:  getFirst('CN') ?? '',
      organization: orgs.length > 0 ? orgs : undefined,
      org_unit:     ous.length  > 0 ? ous  : undefined,
      country:      getFirst('C'),
      state:        getFirst('ST'),
      city:         getFirst('L'),
      email:        getFirst('emailAddress'),
      cert_type:    values.cert_type,
      validity_days: Number(values.validity_days),
      key_size:     Number(values.key_size) as 2048 | 4096,
      san_dns:      values.san_dns || undefined,
      san_ip:       values.san_ip  || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Certificate</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

            <DNPreview control={form.control} />

            <div className="space-y-2">
              <Label>Subject Attributes</Label>
              {fields.map((field, index) => {
                const currentKey = watchedAttributes?.[index]?.key as X509Key | undefined
                return (
                  <div key={field.id} className="flex gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`attributes.${index}.key`}
                      render={({ field: f }) => (
                        <FormItem className="w-44 shrink-0">
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {X509_KEYS.map(k => (
                                <SelectItem key={k} value={k}>{X509_LABELS[k]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`attributes.${index}.value`}
                      render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              {...f}
                              maxLength={currentKey === 'C' ? 2 : undefined}
                              placeholder={currentKey === 'C' ? 'DE' : undefined}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-0 shrink-0"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ key: 'CN', value: '' })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Attribute
              </Button>
              {form.formState.errors.attributes && !Array.isArray(form.formState.errors.attributes) && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.attributes.message ?? form.formState.errors.attributes.root?.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cert_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Certificate Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="server+client">Server + Client (NiFi)</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="validity_days" render={({ field }) => (
                <FormItem>
                  <FormLabel>Validity (days)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="key_size" render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Size</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="2048">2048 bit</SelectItem>
                      <SelectItem value="4096">4096 bit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="san_dns" render={({ field }) => (
              <FormItem>
                <FormLabel>DNS SANs (comma-separated)</FormLabel>
                <FormControl>
                  <Textarea placeholder="api.example.com, www.example.com" rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="san_ip" render={({ field }) => (
              <FormItem>
                <FormLabel>IP SANs (comma-separated)</FormLabel>
                <FormControl>
                  <Textarea placeholder="192.168.1.1, 10.0.0.1" rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Issuing...' : 'Issue Certificate'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
