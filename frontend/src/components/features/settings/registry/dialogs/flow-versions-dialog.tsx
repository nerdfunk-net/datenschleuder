'use client'

import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, User, Clock, MessageSquare } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import type { RegistryFlow, FlowVersion } from '../types'

interface Props {
  flow: RegistryFlow | null
  instanceId: number | null
  onClose: () => void
}

export function FlowVersionsDialog({ flow, instanceId, onClose }: Props) {
  const { apiCall } = useApi()
  const open = !!flow && !!instanceId

  const { data, isLoading, error } = useQuery<{ versions: FlowVersion[] }>({
    queryKey: ['flow-versions', instanceId, flow?.registry_id, flow?.bucket_id, flow?.flow_id],
    queryFn: () =>
      apiCall(
        `nifi/instances/${instanceId}/ops/registries/${flow!.registry_id}/buckets/${flow!.bucket_id}/flows/${flow!.flow_id}/versions`
      ),
    enabled: open,
    staleTime: 60 * 1000,
  })

  const versions = data?.versions ?? []

  const formatTs = (ts: number | null) =>
    ts ? new Date(ts).toLocaleString() : 'Unknown'

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Flow Versions
            {flow && (
              <span className="block text-sm font-normal text-slate-500 mt-0.5">{flow.flow_name}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading versions…
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 py-4 text-center">
              {error instanceof Error ? error.message : 'Failed to load versions'}
            </p>
          )}

          {!isLoading && !error && versions.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No versions found for this flow.</p>
          )}

          {versions.map((v, i) => (
            <div
              key={v.version}
              className="rounded-lg border-l-4 border-blue-500 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Version {v.version}</span>
                  {i === 0 && <Badge className="bg-green-600 text-white text-xs">LATEST</Badge>}
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <User className="h-3 w-3" /> {v.author}
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" /> {formatTs(v.timestamp)}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-1.5 text-sm text-slate-600 bg-white rounded p-2">
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                <span className={!v.comments ? 'italic text-slate-400' : ''}>
                  {v.comments || 'No comments'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
