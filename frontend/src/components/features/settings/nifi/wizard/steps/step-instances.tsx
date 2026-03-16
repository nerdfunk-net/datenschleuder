'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus, Network, Trash2, Edit, X, Loader2, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWizardStore } from '../wizard-store'
import { useNifiCertificatesQuery, useOidcProvidersQuery } from '../../hooks/use-nifi-instances-query'
import { useNifiInstancesMutations } from '../../hooks/use-nifi-instances-mutations'
import { tryParseNifiError } from '../../utils/parse-error'
import { useApi } from '@/hooks/use-api'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import type { WizardInstance } from '../types'
import type { NifiInstanceFormValues } from '../../types'

interface GitRepo {
  id: number
  name: string
  category: string
}

const EMPTY_INSTANCE: Omit<WizardInstance, 'tempId'> = {
  name: '',
  serverTempId: '',
  nifi_url: '',
  authMethod: 'certificate',
  username: '',
  password: '',
  oidcProvider: '',
  certificateName: '',
  use_ssl: true,
  verify_ssl: true,
  check_hostname: true,
  git_config_repo_id: 0,
}

export function StepInstances() {
  const servers = useWizardStore((s) => s.servers)
  const instances = useWizardStore((s) => s.instances)
  const addInstance = useWizardStore((s) => s.addInstance)
  const updateInstance = useWizardStore((s) => s.updateInstance)
  const removeInstance = useWizardStore((s) => s.removeInstance)

  const { data: certsData } = useNifiCertificatesQuery()
  const certificates = certsData?.certificates ?? []

  const { data: oidcData } = useOidcProvidersQuery()
  const oidcProviders = oidcData?.providers ?? []

  const { testNewConnection } = useNifiInstancesMutations()
  const { toast } = useToast()

  const { apiCall } = useApi()
  const { data: gitReposData } = useQuery({
    queryKey: ['git-repositories', 'nifi_configs'],
    queryFn: () => apiCall<{ repositories: GitRepo[] }>('git-repositories/?category=nifi_configs'),
    staleTime: 30_000,
  })
  const gitRepos = useMemo(() => gitReposData?.repositories ?? [], [gitReposData])

  const [editingTempId, setEditingTempId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<WizardInstance, 'tempId'>>(EMPTY_INSTANCE)

  const resetForm = useCallback(() => {
    setForm(EMPTY_INSTANCE)
    setEditingTempId(null)
  }, [])

  const handleEdit = useCallback(
    (inst: WizardInstance) => {
      setEditingTempId(inst.tempId)
      setForm({
        name: inst.name,
        serverTempId: inst.serverTempId,
        nifi_url: inst.nifi_url,
        authMethod: inst.authMethod,
        username: inst.username,
        password: inst.password,
        oidcProvider: inst.oidcProvider,
        certificateName: inst.certificateName,
        use_ssl: inst.use_ssl,
        verify_ssl: inst.verify_ssl,
        check_hostname: inst.check_hostname,
        git_config_repo_id: inst.git_config_repo_id,
        git_repo_name: inst.git_repo_name,
      })
    },
    []
  )

  const isFormValid = useMemo(
    () =>
      !!form.name.trim() &&
      !!form.serverTempId &&
      !!form.nifi_url.trim() &&
      form.git_config_repo_id > 0 &&
      (form.authMethod !== 'certificate' || !!form.certificateName),
    [form.name, form.serverTempId, form.nifi_url, form.git_config_repo_id, form.authMethod, form.certificateName]
  )

  const handleCheckConnection = useCallback(async () => {
    if (!form.nifi_url.trim()) {
      toast({ title: 'Error', description: 'Please enter a NiFi URL first.', variant: 'destructive' })
      return
    }
    if (form.authMethod === 'oidc' && !form.oidcProvider) {
      toast({ title: 'Error', description: 'Please select an OIDC provider.', variant: 'destructive' })
      return
    }
    if (form.authMethod === 'certificate' && !form.certificateName) {
      toast({ title: 'Error', description: 'Please select a certificate.', variant: 'destructive' })
      return
    }
    const values: NifiInstanceFormValues = {
      name: form.name,
      server_id: '__none__',
      nifi_url: form.nifi_url,
      authMethod: form.authMethod,
      username: form.username,
      password: form.password,
      oidcProvider: form.oidcProvider,
      certificateName: form.certificateName,
      use_ssl: form.use_ssl,
      verify_ssl: form.verify_ssl,
      check_hostname: form.check_hostname,
      git_config_repo_id: '__none__',
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

  const handleSubmit = useCallback(() => {
    if (!isFormValid) return
    const repoName = gitRepos.find((r) => r.id === form.git_config_repo_id)?.name ?? ''
    if (editingTempId) {
      updateInstance(editingTempId, { ...form, git_repo_name: repoName })
    } else {
      addInstance({
        ...form,
        tempId: `inst-${Date.now()}`,
        git_repo_name: repoName,
      })
    }
    resetForm()
  }, [isFormValid, editingTempId, form, gitRepos, addInstance, updateInstance, resetForm])

  const updateField = useCallback(
    <K extends keyof Omit<WizardInstance, 'tempId'>>(key: K, value: Omit<WizardInstance, 'tempId'>[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Step 2: NiFi Instances</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure NiFi instances for your cluster. Each instance must have a git config repository assigned.
        </p>
      </div>

      {/* Instance form */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            {editingTempId ? 'Edit Instance' : 'Add Instance'}
          </h3>
          {editingTempId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="inst-name">Name *</Label>
            <Input
              id="inst-name"
              placeholder="e.g. nifi-prod-1"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="inst-server">Server *</Label>
            <Select
              value={form.serverTempId}
              onValueChange={(v) => updateField('serverTempId', v)}
            >
              <SelectTrigger id="inst-server">
                <SelectValue placeholder="Select server..." />
              </SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.tempId} value={s.tempId}>
                    {s.server_id} ({s.hostname})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="inst-url">NiFi URL *</Label>
            <Input
              id="inst-url"
              placeholder="https://nifi-node1:8443"
              value={form.nifi_url}
              onChange={(e) => updateField('nifi_url', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="inst-git-repo">Git Config Repository *</Label>
            <Select
              value={form.git_config_repo_id > 0 ? String(form.git_config_repo_id) : ''}
              onValueChange={(v) => updateField('git_config_repo_id', Number(v))}
            >
              <SelectTrigger id="inst-git-repo">
                <SelectValue placeholder="Select repository..." />
              </SelectTrigger>
              <SelectContent>
                {gitRepos.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Auth method */}
        <div className="space-y-3">
          <Label>Authentication Method</Label>
          <Select
            value={form.authMethod}
            onValueChange={(v) => updateField('authMethod', v as WizardInstance['authMethod'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="certificate">Client Certificate</SelectItem>
              <SelectItem value="oidc">OIDC Provider</SelectItem>
              <SelectItem value="username">Username & Password</SelectItem>
            </SelectContent>
          </Select>

          {form.authMethod === 'username' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inst-username">Username</Label>
                <Input
                  id="inst-username"
                  value={form.username}
                  onChange={(e) => updateField('username', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="inst-password">Password</Label>
                <Input
                  id="inst-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                />
              </div>
            </div>
          )}

          {form.authMethod === 'oidc' && (
            <div>
              <Label htmlFor="inst-oidc">OIDC Provider</Label>
              <Select
                value={form.oidcProvider}
                onValueChange={(v) => updateField('oidcProvider', v)}
              >
                <SelectTrigger id="inst-oidc">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {oidcProviders.map((p) => (
                    <SelectItem key={p.provider_id} value={p.provider_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.authMethod === 'certificate' && (
            <div>
              <Label htmlFor="inst-cert">Certificate</Label>
              <Select
                value={form.certificateName}
                onValueChange={(v) => updateField('certificateName', v)}
              >
                <SelectTrigger id="inst-cert">
                  <SelectValue placeholder="Select certificate..." />
                </SelectTrigger>
                <SelectContent>
                  {certificates.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* SSL */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="inst-ssl"
              checked={form.use_ssl}
              onCheckedChange={(v) => updateField('use_ssl', v)}
            />
            <Label htmlFor="inst-ssl">Use SSL</Label>
          </div>
          {form.use_ssl && (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  id="inst-verify-ssl"
                  checked={form.verify_ssl}
                  onCheckedChange={(v) => updateField('verify_ssl', v)}
                />
                <Label htmlFor="inst-verify-ssl">Verify SSL</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="inst-check-hostname"
                  checked={form.check_hostname}
                  onCheckedChange={(v) => updateField('check_hostname', v)}
                />
                <Label htmlFor="inst-check-hostname">Check Hostname</Label>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!form.nifi_url.trim() || testNewConnection.isPending}
            onClick={handleCheckConnection}
          >
            {testNewConnection.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-1 h-4 w-4" />
            )}
            Check Connection
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            {editingTempId ? 'Update Instance' : 'Add Instance'}
          </Button>
        </div>
      </div>

      {/* Instance list */}
      {instances.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700">
            Configured Instances ({instances.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instances.map((inst) => {
              const server = servers.find((s) => s.tempId === inst.serverTempId)
              return (
                <div
                  key={inst.tempId}
                  className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-5 w-5 text-slate-500" />
                      <span className="text-sm font-medium text-slate-900">{inst.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(inst)}
                        className="h-7 w-7"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInstance(inst.tempId)}
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>URL: {inst.nifi_url}</p>
                    <p>Server: {server?.server_id ?? 'Unknown'}</p>
                    <p>Git Repo: {inst.git_repo_name || `ID ${inst.git_config_repo_id}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {inst.authMethod}
                    </Badge>
                    {inst.use_ssl && (
                      <Badge variant="outline" className="text-xs">
                        SSL
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {instances.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Network className="mx-auto h-12 w-12 text-slate-300 mb-2" />
          <p>No instances configured yet. Add at least one instance to continue.</p>
        </div>
      )}
    </div>
  )
}
