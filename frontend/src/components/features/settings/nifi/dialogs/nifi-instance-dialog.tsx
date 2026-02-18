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
  useNifiHierarchyQuery,
  useNifiHierarchyValuesQuery,
  useNifiCertificatesQuery,
  useOidcProvidersQuery,
} from '../hooks/use-nifi-instances-query'
import { useNifiInstancesMutations } from '../hooks/use-nifi-instances-mutations'
import type { NifiInstance, NifiInstanceFormValues } from '../types'

const schema = z.object({
  name: z.string(),
  hierarchy_attribute: z.string().min(1, 'Required'),
  hierarchy_value: z.string().min(1, 'Required'),
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

  const { data: hierarchyData } = useNifiHierarchyQuery()
  const { data: certificatesData } = useNifiCertificatesQuery()
  const { data: oidcData } = useOidcProvidersQuery()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      hierarchy_attribute: '',
      hierarchy_value: '',
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

  const watchedAttribute = useWatch({ control: form.control, name: 'hierarchy_attribute' })
  const watchedAuthMethod = useWatch({ control: form.control, name: 'authMethod' })
  const watchedHierarchyValue = useWatch({ control: form.control, name: 'hierarchy_value' })

  const { data: valuesData } = useNifiHierarchyValuesQuery(watchedAttribute)

  // Debug logging
  useEffect(() => {
    if (open) {
      console.log('[NifiInstanceDialog] Form state:', {
        isEdit,
        instanceData: instance,
        watchedAttribute,
        watchedHierarchyValue,
        valuesData,
        hierarchyValueOptions: valuesData?.values || []
      })
    }
  }, [open, isEdit, instance, watchedAttribute, watchedHierarchyValue, valuesData])

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
        hierarchy_attribute: instance.hierarchy_attribute,
        hierarchy_value: instance.hierarchy_value,
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
      const topAttr = hierarchyData?.hierarchy?.[0]
      form.reset({
        name: '',
        hierarchy_attribute: topAttr?.name || '',
        hierarchy_value: '',
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
  }, [open, instance, hierarchyData, form])

  const hierarchyAttributeOptions = useMemo(() => {
    const attrs = hierarchyData?.hierarchy || []
    // Only the first (top) attribute is used for NiFi instances
    if (attrs.length === 0) return []
    const top = attrs[0]
    if (!top) return []
    return [{ value: top.name, label: `${top.name} (${top.label})` }]
  }, [hierarchyData])

  const hierarchyValueOptions = useMemo(
    () => valuesData?.values || [],
    [valuesData]
  )

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

            <div className="grid grid-cols-2 gap-4">
              {/* Hierarchy Attribute */}
              <FormField
                control={form.control}
                name="hierarchy_attribute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hierarchy Attribute</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select attribute" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {hierarchyAttributeOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                        {hierarchyAttributeOptions.length === 0 && (
                          <SelectItem value="_none" disabled>No hierarchy configured</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hierarchy Value */}
              <FormField
                control={form.control}
                name="hierarchy_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hierarchy Value</FormLabel>
                    {isEdit ? (
                      <Input
                        value={field.value}
                        disabled
                        className="bg-slate-50"
                      />
                    ) : (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedAttribute}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hierarchyValueOptions.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                          {hierarchyValueOptions.length === 0 && (
                            <SelectItem value="_none" disabled>
                              {watchedAttribute ? 'No values defined' : 'Select attribute first'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
