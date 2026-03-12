'use client'

import { useEffect, useMemo, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
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
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import {
  useNifiCertificatesQuery,
  useOidcProvidersQuery,
} from '../hooks/use-nifi-instances-query'
import { useNifiInstancesMutations } from '../hooks/use-nifi-instances-mutations'
import { useNifiServersQuery } from '../hooks/use-nifi-servers-query'
import type { NifiInstance, NifiInstanceFormValues, NifiServer } from '../types'
import { tryParseNifiError } from '../utils/parse-error'

const NO_SERVER = '__none__'
const NO_REPO = '__none__'
const EMPTY_SERVERS: NifiServer[] = []

interface GitRepo {
  id: number
  name: string
  url: string
}

interface GitReposResponse {
  repositories: GitRepo[]
}

const EMPTY_GIT_REPOS: GitRepo[] = []

const schema = z.object({
  name: z.string(),
  server_id: z.string().optional(),
  nifi_url: z.string().url('Must be a valid URL'),
  git_config_repo_id: z.string(),
  authMethod: z.string().min(1, 'Required'),
  username: z.string(),
  password: z.string(),
  oidcProvider: z.string(),
  certificateName: z.string(),
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
  const { apiCall } = useApi()
  const { createInstance, updateInstance, testNewConnection } = useNifiInstancesMutations()

  const { data: certificatesData } = useNifiCertificatesQuery()
  const { data: oidcData } = useOidcProvidersQuery()
  const { data: servers = EMPTY_SERVERS } = useNifiServersQuery()

  const { data: gitReposData } = useQuery<GitReposResponse>({
    queryKey: queryKeys.git.repositoriesByCategory('nifi_configs'),
    queryFn: () => apiCall('git-repositories/?category=nifi_configs') as Promise<GitReposResponse>,
    staleTime: 5 * 60 * 1000,
  })
  const gitRepos = gitReposData?.repositories ?? EMPTY_GIT_REPOS

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      server_id: NO_SERVER,
      nifi_url: '',
      git_config_repo_id: NO_REPO,
      authMethod: 'username',
      username: '',
      password: '',
      oidcProvider: '',
      certificateName: '',
      use_ssl: true,
      verify_ssl: true,
      check_hostname: true,
    },
  })

  const watchedAuthMethod = useWatch({ control: form.control, name: 'authMethod' })

  useEffect(() => {
    if (!open) return

    if (instance) {
      let authMethod = 'username'
      if (instance.oidc_provider_id) {
        authMethod = 'oidc'
      } else if (instance.certificate_name) {
        authMethod = 'certificate'
      }
      form.reset({
        name: instance.name || '',
        server_id: instance.server_id ? String(instance.server_id) : NO_SERVER,
        nifi_url: instance.nifi_url,
        git_config_repo_id: instance.git_config_repo_id ? String(instance.git_config_repo_id) : NO_REPO,
        authMethod,
        username: instance.username || '',
        password: '',
        oidcProvider: instance.oidc_provider_id || '',
        certificateName: instance.certificate_name || '',
        use_ssl: instance.use_ssl,
        verify_ssl: instance.verify_ssl,
        check_hostname: instance.check_hostname,
      })
    } else {
      form.reset({
        name: '',
        server_id: NO_SERVER,
        nifi_url: '',
        git_config_repo_id: NO_REPO,
        authMethod: 'username',
        username: '',
        password: '',
        oidcProvider: '',
        certificateName: '',
        use_ssl: true,
        verify_ssl: true,
        check_hostname: true,
      })
    }
  }, [open, instance, form])

  const authMethodOptions = useMemo(() => [
    { value: 'username', label: 'Username / Password' },
    { value: 'oidc', label: 'OIDC Authentication' },
    { value: 'certificate', label: 'Certificate (PEM)' },
  ], [])

  const certificateOptions = useMemo(
    () => certificatesData?.certificates || [],
    [certificatesData]
  )

  const oidcProviderOptions = useMemo(
    () => oidcData?.providers || [],
    [oidcData]
  )

  const handleTestConnection = useCallback(async () => {
    const values = form.getValues() as unknown as NifiInstanceFormValues
    if (!values.nifi_url) {
      toast({ title: 'Error', description: 'Please enter a NiFi URL first.', variant: 'destructive' })
      return
    }
    if (values.authMethod === 'oidc' && !values.oidcProvider) {
      toast({ title: 'Error', description: 'Please select an OIDC provider.', variant: 'destructive' })
      return
    }
    try {
      const result = await testNewConnection.mutateAsync(values)
      if (result.status === 'success') {
        toast({
          title: 'Connection successful',
          description: `${result.message}${result.details?.version ? ` — Version: ${result.details.version}` : ''}`,
        })
      } else {
        const detail = result.details?.error ? `\n\nDetails: ${result.details.error}` : ''
        toast({ title: 'Connection failed', description: `${result.message}${detail}`, variant: 'destructive' })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred.'
      const parsed = tryParseNifiError(msg)
      toast({ title: 'Connection failed', description: parsed, variant: 'destructive' })
    }
  }, [form, testNewConnection, toast])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      ...values,
      nifi_url: values.nifi_url.replace(/\/+$/, ''),
    } as unknown as NifiInstanceFormValues
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit NiFi Instance' : 'Add NiFi Instance'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* ── General ── */}
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                <span className="text-sm font-medium">General</span>
              </div>
              <div className="p-4 space-y-4 bg-gradient-to-b from-white to-slate-50">

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

              <FormField
                control={form.control}
                name="git_config_repo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NiFi Config <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_REPO}>None</SelectItem>
                        {gitRepos.map(r => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name}
                          </SelectItem>
                        ))}
                        {gitRepos.length === 0 && (
                          <SelectItem value="_empty" disabled>No Nifi Configs repositories configured</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>Git repository containing the NiFi configuration files</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
            </div>

            {/* ── Connection with Authentication ── */}
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-violet-400/80 to-violet-500/80 text-white py-2 px-4 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                <span className="text-sm font-medium">Connection with Authentication</span>
              </div>
              <div className="p-4 space-y-4 bg-gradient-to-b from-white to-slate-50">

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

              {watchedAuthMethod === 'certificate' && (
                <FormField
                  control={form.control}
                  name="certificateName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certificate</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select certificate" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {certificateOptions.map(c => (
                            <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                          ))}
                          {certificateOptions.length === 0 && (
                            <SelectItem value="_none" disabled>No certificates configured in certs/certificates.yaml</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>Client certificate from certs/certificates.yaml</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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
              </div>
            </div>

            {/* ── Connection Options ── */}
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-emerald-400/80 to-emerald-500/80 text-white py-2 px-4 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <span className="text-sm font-medium">Connection Options</span>
              </div>
              <div className="p-4 space-y-3 bg-gradient-to-b from-white to-slate-50">
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
                      <FormLabel className="font-normal">Verify SSL certificates</FormLabel>
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
                      <FormLabel className="font-normal">Verify SSL hostname</FormLabel>
                      <FormDescription className="!mt-0 ml-1">(recommended for production)</FormDescription>
                    </FormItem>
                  )}
                />
              </div>
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
