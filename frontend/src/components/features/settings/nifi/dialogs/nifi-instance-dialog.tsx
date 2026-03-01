'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
  FormDescription,
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
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plug } from 'lucide-react'
import {
  useNifiCertificatesQuery,
  useOidcProvidersQuery,
} from '../hooks/use-nifi-instances-query'
import { useNifiInstancesMutations } from '../hooks/use-nifi-instances-mutations'
import { useNifiServersQuery } from '../hooks/use-nifi-servers-query'
import type { NifiInstance, NifiInstanceFormValues, NifiServer } from '../types'

const NO_SERVER = '__none__'
const EMPTY_SERVERS: NifiServer[] = []

const schema = z.object({
  name: z.string(),
  server_id: z.string().optional(),
  nifi_url: z.string().url('Must be a valid URL'),
  authMethod: z.string().min(1, 'Required'),
  username: z.string(),
  password: z.string(),
  oidcProvider: z.string(),
  use_ssl: z.boolean(),
  verify_ssl: z.boolean(),
  check_hostname: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  instance?: NifiInstance | null
}

export function NifiInstanceDialog({ open, onOpenChange, instance }: Props) {
  const isEdit = !!instance
  const { toast } = useToast()
  const { createInstance, updateInstance, testNewConnection } = useNifiInstancesMutations()

  const { data: certificatesData } = useNifiCertificatesQuery()
  const { data: oidcData } = useOidcProvidersQuery()
  const { data: servers = EMPTY_SERVERS } = useNifiServersQuery()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      server_id: NO_SERVER,
      nifi_url: '',
      authMethod: 'username',
      username: '',
      password: '',
      oidcProvider: '',
      use_ssl: true,
      verify_ssl: true,
      check_hostname: true,
    },
  })

  const watchedAuthMethod = useWatch({ control: form.control, name: 'authMethod' })

  // Reset form when dialog opens/closes or instance changes
  useEffect(() => {
    if (!open) return

    if (instance) {
      let authMethod = 'username'
      if (instance.oidc_provider_id) {
        authMethod = 'oidc'
      } else if (instance.certificate_name) {
        authMethod = `cert:${instance.certificate_name}`
      }
      form.reset({
        name: instance.name || '',
        server_id: instance.server_id ? String(instance.server_id) : NO_SERVER,
        nifi_url: instance.nifi_url,
        authMethod,
        username: instance.username || '',
        password: '',
        oidcProvider: instance.oidc_provider_id || '',
        use_ssl: instance.use_ssl,
        verify_ssl: instance.verify_ssl,
        check_hostname: instance.check_hostname,
      })
    } else {
      form.reset({
        name: '',
        server_id: NO_SERVER,
        nifi_url: '',
        authMethod: 'username',
        username: '',
        password: '',
        oidcProvider: '',
        use_ssl: true,
        verify_ssl: true,
        check_hostname: true,
      })
    }
  }, [open, instance, form])

  const authMethodOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: 'username', label: 'Username / Password' },
      { value: 'oidc', label: 'OIDC Authentication' },
    ]
    for (const cert of certificatesData?.certificates || []) {
      options.push({ value: `cert:${cert.name}`, label: `Certificate: ${cert.name}` })
    }
    return options
  }, [certificatesData])

  const oidcProviderOptions = useMemo(
    () => oidcData?.providers || [],
    [oidcData]
  )

  const handleTestConnection = async () => {
    const values = form.getValues() as unknown as NifiInstanceFormValues
    if (!values.nifi_url) {
      toast({ title: 'Error', description: 'Please enter a NiFi URL first.', variant: 'destructive' })
      return
    }
    if (values.authMethod === 'oidc' && !values.oidcProvider) {
      toast({ title: 'Error', description: 'Please select an OIDC provider.', variant: 'destructive' })
      return
    }
    const result = await testNewConnection.mutateAsync(values)
    if (result.status === 'success') {
      toast({
        title: 'Connection successful',
        description: `${result.message}${result.details?.version ? ` — Version: ${result.details.version}` : ''}`,
      })
    } else {
      toast({ title: 'Connection failed', description: result.message, variant: 'destructive' })
    }
  }

  const onSubmit = async (values: FormValues) => {
    const payload = values as unknown as NifiInstanceFormValues
    if (isEdit && instance) {
      await updateInstance.mutateAsync({ id: instance.id, values: payload })
    } else {
      await createInstance.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  const isPending = createInstance.isPending || updateInstance.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit NiFi Instance' : 'Add NiFi Instance'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name (optional) */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Production NiFi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Server (optional) */}
            <FormField
              control={form.control}
              name="server_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_SERVER}>None</SelectItem>
                      {servers.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.server_id} <span className="text-slate-400">({s.hostname})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* NiFi URL */}
            <FormField
              control={form.control}
              name="nifi_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NiFi URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://nifi.example.com:8443/nifi-api" {...field} />
                  </FormControl>
                  <FormDescription>Full NiFi API endpoint URL (must end with /nifi-api)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auth Method */}
            <FormField
              control={form.control}
              name="authMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authentication Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {authMethodOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* OIDC Provider */}
            {watchedAuthMethod === 'oidc' && (
              <FormField
                control={form.control}
                name="oidcProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OIDC Provider</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {oidcProviderOptions.map(p => (
                          <SelectItem key={p.provider_id} value={p.provider_id}>{p.name}</SelectItem>
                        ))}
                        {oidcProviderOptions.length === 0 && (
                          <SelectItem value="_none" disabled>No OIDC providers configured</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>Select an OIDC provider from config/oidc_providers.yaml</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Username / Password */}
            {watchedAuthMethod === 'username' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* SSL Options */}
            <div className="space-y-3 rounded-md border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">SSL Options</p>
              <FormField
                control={form.control}
                name="use_ssl"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Use SSL/TLS</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="verify_ssl"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Verify SSL Certificates</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="check_hostname"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">Verify SSL Hostname</FormLabel>
                    <FormDescription className="!mt-0 ml-1">
                      (recommended for production)
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={testNewConnection.isPending}
                onClick={handleTestConnection}
              >
                {testNewConnection.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Create'} Instance
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
