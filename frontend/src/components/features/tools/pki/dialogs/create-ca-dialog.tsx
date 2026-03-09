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
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { CreateCARequest } from '../types'

const schema = z.object({
  common_name: z.string().min(1, 'Required'),
  organization: z.string().optional(),
  country: z.string().max(2).optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  org_unit: z.string().optional(),
  email: z.string().optional(),
  validity_days: z.string().min(1),
  key_size: z.enum(['2048', '4096']),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateCARequest) => void
  isPending: boolean
}

export function CreateCADialog({ open, onOpenChange, onSubmit, isPending }: Props) {
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
      validity_days: '3650',
      key_size: '4096',
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
      validity_days: Number(values.validity_days),
      key_size: Number(values.key_size) as 2048 | 4096,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Certificate Authority</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="common_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Common Name *</FormLabel>
                <FormControl><Input placeholder="My Root CA" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="organization" render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <FormControl><Input placeholder="Acme Corp" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country (2-char)</FormLabel>
                  <FormControl><Input placeholder="DE" maxLength={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input placeholder="Bavaria" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input placeholder="Munich" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="org_unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Org Unit</FormLabel>
                  <FormControl><Input placeholder="IT" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="ca@example.com" {...field} /></FormControl>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create CA'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
