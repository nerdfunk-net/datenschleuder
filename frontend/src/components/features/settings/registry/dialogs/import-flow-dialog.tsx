'use client'

import { useState, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/lib/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useNifiInstancesQuery } from '../../nifi/hooks/use-nifi-instances-query'
import type { NifiInstance } from '../../nifi/types'
import type { Bucket, RemoteFlow, RegistryClient } from '../types'

const EMPTY_INSTANCES: NifiInstance[] = []

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportFlowDialog({ open, onOpenChange }: Props) {
  const { apiCall } = useApi()
  const { token } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: instances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const fileRef = useRef<HTMLInputElement>(null)

  const [instance, setInstance] = useState<NifiInstance | null>(null)
  const [registries, setRegistries] = useState<RegistryClient[]>([])
  const [registry, setRegistry] = useState<RegistryClient | null>(null)
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [bucket, setBucket] = useState<Bucket | null>(null)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [flowName, setFlowName] = useState('')
  const [existingFlows, setExistingFlows] = useState<RemoteFlow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<RemoteFlow | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loadingRegs, setLoadingRegs] = useState(false)
  const [loadingBuckets, setLoadingBuckets] = useState(false)
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [importing, setImporting] = useState(false)

  const reset = useCallback(() => {
    setInstance(null); setRegistries([]); setRegistry(null)
    setBuckets([]); setBucket(null); setMode('new'); setFlowName('')
    setExistingFlows([]); setSelectedFlow(null); setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => { reset(); onOpenChange(false) }, [reset, onOpenChange])

  const handleInstanceChange = useCallback(async (id: string) => {
    const inst = instances.find(i => String(i.id) === id) ?? null
    setInstance(inst); setRegistry(null); setBuckets([]); setBucket(null)
    setExistingFlows([]); setSelectedFlow(null)
    if (!inst) return
    setLoadingRegs(true)
    try {
      const res = await apiCall(`nifi/instances/${inst.id}/ops/registries`) as { registry_clients: RegistryClient[] }
      setRegistries(res.registry_clients ?? [])
    } finally { setLoadingRegs(false) }
  }, [instances, apiCall])

  const handleRegistryChange = useCallback(async (id: string) => {
    const reg = registries.find(r => r.id === id) ?? null
    setRegistry(reg); setBucket(null); setExistingFlows([]); setSelectedFlow(null)
    if (!reg || !instance) return
    setLoadingBuckets(true)
    try {
      const res = await apiCall(`nifi/instances/${instance.id}/ops/registries/${reg.id}/buckets`) as { buckets: Bucket[] }
      setBuckets(res.buckets ?? [])
    } finally { setLoadingBuckets(false) }
  }, [registries, instance, apiCall])

  const handleBucketChange = useCallback(async (id: string) => {
    const b = buckets.find(x => x.identifier === id) ?? null
    setBucket(b); setExistingFlows([]); setSelectedFlow(null)
    if (mode === 'existing' && b && instance && registry) {
      setLoadingFlows(true)
      try {
        const res = await apiCall(`nifi/instances/${instance.id}/ops/registries/${registry.id}/buckets/${b.identifier}/flows`) as { flows: RemoteFlow[] }
        setExistingFlows(res.flows ?? [])
      } finally { setLoadingFlows(false) }
    }
  }, [buckets, mode, instance, registry, apiCall])

  const handleModeChange = useCallback(async (m: string) => {
    setMode(m as 'new' | 'existing'); setSelectedFlow(null)
    if (m === 'existing' && bucket && instance && registry) {
      setLoadingFlows(true)
      try {
        const res = await apiCall(`nifi/instances/${instance.id}/ops/registries/${registry.id}/buckets/${bucket.identifier}/flows`) as { flows: RemoteFlow[] }
        setExistingFlows(res.flows ?? [])
      } finally { setLoadingFlows(false) }
    }
  }, [bucket, instance, registry, apiCall])

  const canImport = bucket && file && (
    (mode === 'new' && flowName.trim()) || (mode === 'existing' && selectedFlow)
  )

  const handleImport = useCallback(async () => {
    if (!canImport || !instance || !registry || !bucket || !file) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (mode === 'new') formData.append('flow_name', flowName.trim())
      else formData.append('flow_id', selectedFlow!.identifier)

      const url = `/api/proxy/nifi/instances/${instance.id}/ops/registries/${registry.id}/buckets/${bucket.identifier}/import-flow`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Import failed' }))
        throw new Error(err.detail || 'Import failed')
      }
      const result = await res.json()
      toast({ title: 'Success', description: `Flow imported: ${result.flow_name ?? file.name}` })
      queryClient.invalidateQueries({ queryKey: queryKeys.registryFlows.all })
      handleClose()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Import failed', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }, [canImport, instance, registry, bucket, file, mode, flowName, selectedFlow, token, toast, queryClient, handleClose])

  const Step = ({ n, label }: { n: number; label: string }) => (
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{n}. {label}</p>
  )

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Flow</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Step 1 */}
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
            <Step n={1} label="Select NiFi Instance" />
            <Select onValueChange={handleInstanceChange}>
              <SelectTrigger><SelectValue placeholder="— Select instance —" /></SelectTrigger>
              <SelectContent>
                {instances.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.hierarchy_value} ({i.nifi_url})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2 */}
          {instance && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
              <Step n={2} label="Select Registry" />
              {loadingRegs
                ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                : <Select onValueChange={handleRegistryChange} disabled={registries.length === 0}>
                    <SelectTrigger><SelectValue placeholder={registries.length === 0 ? 'No registries' : '— Select registry —'} /></SelectTrigger>
                    <SelectContent>{registries.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>}
            </div>
          )}

          {/* Step 3 */}
          {registry && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
              <Step n={3} label="Select Bucket" />
              {loadingBuckets
                ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                : <Select onValueChange={handleBucketChange} disabled={buckets.length === 0}>
                    <SelectTrigger><SelectValue placeholder={buckets.length === 0 ? 'No buckets' : '— Select bucket —'} /></SelectTrigger>
                    <SelectContent>{buckets.map(b => <SelectItem key={b.identifier} value={b.identifier}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>}
            </div>
          )}

          {/* Step 4 */}
          {bucket && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
              <Step n={4} label="Import Mode" />
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create new flow</SelectItem>
                  <SelectItem value="existing">Add version to existing flow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 5 - flow name or existing */}
          {bucket && mode === 'new' && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
              <Step n={5} label="Flow Name" />
              <Input value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Enter flow name" />
            </div>
          )}

          {bucket && mode === 'existing' && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
              <Step n={5} label="Select Existing Flow" />
              {loadingFlows
                ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                : <Select onValueChange={id => setSelectedFlow(existingFlows.find(f => f.identifier === id) ?? null)} disabled={existingFlows.length === 0}>
                    <SelectTrigger><SelectValue placeholder="— Select flow —" /></SelectTrigger>
                    <SelectContent>{existingFlows.map(f => <SelectItem key={f.identifier} value={f.identifier}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>}
            </div>
          )}

          {/* Step 6 - file */}
          {bucket && ((mode === 'new' && flowName.trim()) || (mode === 'existing' && selectedFlow)) && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
              <Step n={6} label="Select File" />
              <input
                ref={fileRef}
                type="file"
                accept=".json,.yaml,.yml"
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <p className="text-xs text-slate-500">Selected: {file.name}</p>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!canImport || importing}>
            {importing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
              : <><Upload className="mr-2 h-4 w-4" /> Import Flow</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
