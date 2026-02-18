'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useNifiInstancesQuery } from '../../nifi/hooks/use-nifi-instances-query'
import { useRegistryFlowsMutations } from '../hooks/use-registry-flows-mutations'
import type { NifiInstance } from '../../nifi/types'
import type { Bucket, RemoteFlow, RegistryClient } from '../types'

const EMPTY_INSTANCES: NifiInstance[] = []

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddFlowDialog({ open, onOpenChange }: Props) {
  const { apiCall } = useApi()
  const { data: instances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const { createFlows } = useRegistryFlowsMutations()

  const [selectedInstance, setSelectedInstance] = useState<NifiInstance | null>(null)
  const [registry, setRegistry] = useState<RegistryClient | null>(null)
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null)
  const [availableFlows, setAvailableFlows] = useState<RemoteFlow[]>([])
  const [selectedFlowIds, setSelectedFlowIds] = useState<Set<string>>(new Set())
  const [loadingBuckets, setLoadingBuckets] = useState(false)
  const [loadingFlows, setLoadingFlows] = useState(false)

  const reset = useCallback(() => {
    setSelectedInstance(null)
    setRegistry(null)
    setBuckets([])
    setSelectedBucket(null)
    setAvailableFlows([])
    setSelectedFlowIds(new Set())
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onOpenChange(false)
  }, [reset, onOpenChange])

  const handleInstanceChange = useCallback(async (instanceId: string) => {
    const inst = instances.find(i => String(i.id) === instanceId) ?? null
    setSelectedInstance(inst)
    setRegistry(null)
    setBuckets([])
    setSelectedBucket(null)
    setAvailableFlows([])
    setSelectedFlowIds(new Set())
    if (!inst) return

    setLoadingBuckets(true)
    try {
      const res = await apiCall(`nifi/instances/${inst.id}/ops/registries`) as {
        registry_clients: RegistryClient[]
      }
      const clients = res.registry_clients ?? []
      if (clients.length === 0) return
      const first = clients[0]!
      setRegistry(first)
      const bucketsRes = await apiCall(
        `nifi/instances/${inst.id}/ops/registries/${first.id}/buckets`
      ) as { buckets: Bucket[] }
      setBuckets(bucketsRes.buckets ?? [])
    } catch {
      // errors shown via empty state
    } finally {
      setLoadingBuckets(false)
    }
  }, [instances, apiCall])

  const handleBucketChange = useCallback(async (bucketId: string) => {
    const bucket = buckets.find(b => b.identifier === bucketId) ?? null
    setSelectedBucket(bucket)
    setAvailableFlows([])
    setSelectedFlowIds(new Set())
    if (!bucket || !selectedInstance || !registry) return

    setLoadingFlows(true)
    try {
      const res = await apiCall(
        `nifi/instances/${selectedInstance.id}/ops/registries/${registry.id}/buckets/${bucket.identifier}/flows`
      ) as { flows: RemoteFlow[] }
      setAvailableFlows(res.flows ?? [])
    } catch {
      // errors shown via empty state
    } finally {
      setLoadingFlows(false)
    }
  }, [buckets, selectedInstance, registry, apiCall])

  const toggleFlow = useCallback((id: string) => {
    setSelectedFlowIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedInstance || !registry || !selectedBucket || selectedFlowIds.size === 0) return
    const selected = availableFlows.filter(f => selectedFlowIds.has(f.identifier))
    const payload = selected.map(f => ({
      nifi_instance_id: selectedInstance.id,
      nifi_instance_name: selectedInstance.hierarchy_value,
      nifi_instance_url: selectedInstance.nifi_url,
      registry_id: registry.id,
      registry_name: registry.name,
      bucket_id: selectedBucket.identifier,
      bucket_name: selectedBucket.name,
      flow_id: f.identifier,
      flow_name: f.name,
      flow_description: f.description || null,
    }))
    await createFlows.mutateAsync(payload)
    handleClose()
  }, [selectedInstance, registry, selectedBucket, selectedFlowIds, availableFlows, createFlows, handleClose])

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Registry Flows</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: NiFi instance */}
          <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">1. Select NiFi Instance</p>
            <Select onValueChange={handleInstanceChange}>
              <SelectTrigger><SelectValue placeholder="— Select instance —" /></SelectTrigger>
              <SelectContent>
                {instances.map(i => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.hierarchy_value} ({i.nifi_url})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Bucket */}
          {selectedInstance && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">2. Select Bucket</p>
              {loadingBuckets ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading buckets…
                </div>
              ) : (
                <Select onValueChange={handleBucketChange} disabled={buckets.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={buckets.length === 0 ? 'No buckets found' : '— Select bucket —'} />
                  </SelectTrigger>
                  <SelectContent>
                    {buckets.map(b => (
                      <SelectItem key={b.identifier} value={b.identifier}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Step 3: Flows */}
          {selectedBucket && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">3. Select Flows</p>
              {loadingFlows ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading flows…
                </div>
              ) : availableFlows.length === 0 ? (
                <p className="text-sm text-slate-400">No flows found in this bucket.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {availableFlows.map(f => (
                    <label
                      key={f.identifier}
                      className="flex items-start gap-3 p-2 rounded bg-white border border-slate-100 cursor-pointer hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={selectedFlowIds.has(f.identifier)}
                        onCheckedChange={() => toggleFlow(f.identifier)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.name}</p>
                        {f.description && (
                          <p className="text-xs text-slate-500">{f.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={selectedFlowIds.size === 0 || createFlows.isPending}
          >
            {createFlows.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save {selectedFlowIds.size > 0 ? `${selectedFlowIds.size} Flow(s)` : 'Flows'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
