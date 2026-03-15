'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CreateCertificateRequest } from '../types'

const schema = z.object({
  common_name: z.string().min(1, 'Required'),
  organization: z.string().optional(),
  country: z.string().max(2).optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  org_unit: z.string().optional(),
  email: z.string().optional(),
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

export function CreateCertificateDialog({ open, onOpenChange, onSubmit, isPending }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      common_name: '',
      organization: '',
      country: '',
      state: '',
      city: '',
      org_unit: '',
      email: '',
      cert_type: 'server',
      validity_days: '365',
      key_size: '2048',
      san_dns: '',
      san_ip: '',
    },
  })

  const handleSubmit = (values: FormValues) => {
    onSubmit({
      common_name: values.common_name,
      organization: values.organization || undefined,
      country: values.country || undefined,
      state: values.state || undefined,
      city: values.city || undefined,
      org_unit: values.org_unit || undefined,
      email: values.email || undefined,
      cert_type: values.cert_type,
      validity_days: Number(values.validity_days),
      key_size: Number(values.key_size) as 2048 | 4096,
      san_dns: values.san_dns || undefined,
      san_ip: values.san_ip || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Certificate</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="common_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Common Name *</FormLabel>
                <FormControl><Input placeholder="api.example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="organization" render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl><Input maxLength={2} placeholder="DE" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="org_unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Org Unit</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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
