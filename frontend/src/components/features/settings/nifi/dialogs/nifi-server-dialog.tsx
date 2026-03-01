'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useNifiServersMutations } from '../hooks/use-nifi-servers-mutations'
import type { NifiServer } from '../types'

const schema = z.object({
  server_id: z.string().min(1, 'Required'),
  hostname: z.string().min(1, 'Required'),
  credential_id: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Credential {
  id: number
  name: string
  type: string
}

const NO_CREDENTIAL = '__none__'
const EMPTY_CREDENTIALS: Credential[] = []

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  server?: NifiServer | null
}

export function NifiServerDialog({ open, onOpenChange, server }: Props) {
  const isEdit = !!server
  const { apiCall } = useApi()
  const { createServer, updateServer } = useNifiServersMutations()

  const { data: credentialsRaw = EMPTY_CREDENTIALS } = useQuery<Credential[]>({
    queryKey: queryKeys.settings.credentials(),
    queryFn: () => apiCall('credentials') as Promise<Credential[]>,
    staleTime: 60 * 1000,
  })

  const sshCredentials = useMemo(
    () => credentialsRaw.filter(c => c.type === 'ssh' || c.type === 'ssh_key'),
    [credentialsRaw]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { server_id: '', hostname: '', credential_id: NO_CREDENTIAL },
  })

  useEffect(() => {
    if (!open) return
    if (server) {
      form.reset({
        server_id: server.server_id,
        hostname: server.hostname,
        credential_id: server.credential_id ? String(server.credential_id) : NO_CREDENTIAL,
      })
    } else {
      form.reset({ server_id: '', hostname: '', credential_id: NO_CREDENTIAL })
    }
  }, [open, server, form])

  const onSubmit = async (values: FormValues) => {
    const credId = values.credential_id && values.credential_id !== NO_CREDENTIAL
      ? Number(values.credential_id)
      : null

    const payload = {
      server_id: values.server_id,
      hostname: values.hostname,
      credential_id: credId,
    }

    if (isEdit && server) {
      await updateServer.mutateAsync({ id: server.id, data: payload })
    } else {
      await createServer.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  const isPending = createServer.isPending || updateServer.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit NiFi Server' : 'Add NiFi Server'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="server_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. nifi-node-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hostname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hostname / IP</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. nifi1.example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credential_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SSH Credential <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CREDENTIAL}>None</SelectItem>
                      {sshCredentials.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} <span className="text-slate-400">({c.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Create'} Server
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
