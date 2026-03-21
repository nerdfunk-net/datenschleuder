'use client'

import { useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useRedisServerMutations } from '../hooks/use-redis-mutations'
import type { RedisServer } from '../types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535),
  use_tls: z.boolean(),
  db_index: z.number().int().min(0).max(16),
  password: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  server?: RedisServer | null
}

export function RedisServerDialog({ open, onOpenChange, server }: Props) {
  const isEdit = !!server
  const { createServer, updateServer } = useRedisServerMutations()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      host: '',
      port: 6379,
      use_tls: false,
      db_index: 0,
      password: '',
    },
  })

  useEffect(() => {
    if (open) {
      if (server) {
        form.reset({
          name: server.name,
          host: server.host,
          port: server.port,
          use_tls: server.use_tls,
          db_index: server.db_index,
          password: '',
        })
      } else {
        form.reset({
          name: '',
          host: '',
          port: 6379,
          use_tls: false,
          db_index: 0,
          password: '',
        })
      }
    }
  }, [open, server, form])

  const isPending = createServer.isPending || updateServer.isPending

  function onSubmit(values: FormValues) {
    if (isEdit && server) {
      const payload: Record<string, unknown> = {
        name: values.name,
        host: values.host,
        port: values.port,
        use_tls: values.use_tls,
        db_index: values.db_index,
      }
      // Only include password if the field is non-empty
      if (values.password) {
        payload.password = values.password
      } else if (values.password === '') {
        // Explicitly clear the password
        payload.password = ''
      }
      updateServer.mutate(
        { id: server.id, data: payload },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      createServer.mutate(
        {
          name: values.name,
          host: values.host,
          port: values.port,
          use_tls: values.use_tls,
          db_index: values.db_index,
          password: values.password || undefined,
        },
        { onSuccess: () => onOpenChange(false) }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Redis Server' : 'Add Redis Server'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Primary Cache" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input placeholder="localhost" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="db_index"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DB Index</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={16}
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="use_tls"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end pb-1">
                    <FormLabel>Use TLS</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Use TLS"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={isEdit ? 'Leave blank to keep current' : 'Optional'}
                      {...field}
                    />
                  </FormControl>
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
                {isEdit ? 'Save Changes' : 'Add Server'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
