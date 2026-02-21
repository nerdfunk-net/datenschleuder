'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Server } from 'lucide-react'
import type { SystemSnapshot } from '../types'

interface DetailedDiagnosticsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: SystemSnapshot | null
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col p-3 bg-white rounded-md border-l-4 border-blue-400">
      <span className="text-xs text-gray-500 font-medium mb-1">{label}</span>
      <span className="text-sm font-semibold text-slate-900 break-words">{value ?? 'N/A'}</span>
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
      <h4 className="text-sm font-semibold text-slate-600 mb-3">{title}</h4>
      {children}
    </div>
  )
}

export function DetailedDiagnosticsDialog({
  open,
  onOpenChange,
  snapshot,
}: DetailedDiagnosticsDialogProps) {
  if (!snapshot) return null

  const info = snapshot.version_info
  const gcList = snapshot.garbage_collection ?? []
  const contentRepos = snapshot.content_repository_storage_usage ?? []
  const flowFileRepo = snapshot.flowfile_repository_storage_usage
  const provenanceRepos = snapshot.provenance_repository_storage_usage ?? []

  const cpuLoad =
    snapshot.processor_load_average !== undefined && snapshot.processor_load_average !== null
      ? snapshot.processor_load_average.toFixed(2)
      : 'N/A'

  const javaVersion =
    info?.java_version && info?.java_vendor
      ? `${info.java_version} (${info.java_vendor})`
      : 'N/A'

  const osInfo =
    info?.os_name && info?.os_version
      ? `${info.os_name} ${info.os_version} (${info.os_architecture ?? 'N/A'})`
      : 'N/A'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            Detailed System Diagnostics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* System Information */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
              System Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DetailItem label="NiFi Version" value={info?.ni_fi_version ?? 'N/A'} />
              <DetailItem label="Build Tag" value={info?.build_tag ?? 'N/A'} />
              <DetailItem label="Java Version" value={javaVersion} />
              <DetailItem label="OS" value={osInfo} />
              <DetailItem label="Uptime" value={snapshot.uptime ?? 'N/A'} />
              <DetailItem label="Last Refreshed" value={snapshot.stats_last_refreshed ?? 'N/A'} />
            </div>
          </div>

          {/* Memory Usage */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
              Memory Usage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DetailItem label="Heap Utilization" value={snapshot.heap_utilization ?? 'N/A'} />
              <DetailItem label="Used Heap" value={snapshot.used_heap ?? 'N/A'} />
              <DetailItem label="Max Heap" value={snapshot.max_heap ?? 'N/A'} />
              <DetailItem label="Total Heap" value={snapshot.total_heap ?? 'N/A'} />
              <DetailItem label="Free Heap" value={snapshot.free_heap ?? 'N/A'} />
              <DetailItem label="Non-Heap Utilization" value={snapshot.non_heap_utilization ?? 'N/A'} />
              <DetailItem label="Used Non-Heap" value={snapshot.used_non_heap ?? 'N/A'} />
              <DetailItem label="Total Non-Heap" value={snapshot.total_non_heap ?? 'N/A'} />
            </div>
          </div>

          {/* CPU & Threads */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
              CPU &amp; Threads
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DetailItem label="Available Processors" value={String(snapshot.available_processors ?? 'N/A')} />
              <DetailItem label="Processor Load Average" value={cpuLoad} />
              <DetailItem label="Total Threads" value={String(snapshot.total_threads ?? 'N/A')} />
              <DetailItem label="Daemon Threads" value={String(snapshot.daemon_threads ?? 'N/A')} />
            </div>
          </div>

          {/* Storage Repositories */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
              Storage Repositories
            </h3>

            {contentRepos.length > 0 && contentRepos[0] && (
              <SubSection title="Content Repository">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <DetailItem label="Utilization" value={contentRepos[0].utilization ?? 'N/A'} />
                  <DetailItem label="Used Space" value={contentRepos[0].used_space ?? 'N/A'} />
                  <DetailItem label="Free Space" value={contentRepos[0].free_space ?? 'N/A'} />
                  <DetailItem label="Total Space" value={contentRepos[0].total_space ?? 'N/A'} />
                </div>
              </SubSection>
            )}

            {flowFileRepo && (
              <SubSection title="FlowFile Repository">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <DetailItem label="Utilization" value={flowFileRepo.utilization ?? 'N/A'} />
                  <DetailItem label="Used Space" value={flowFileRepo.used_space ?? 'N/A'} />
                  <DetailItem label="Free Space" value={flowFileRepo.free_space ?? 'N/A'} />
                  <DetailItem label="Total Space" value={flowFileRepo.total_space ?? 'N/A'} />
                </div>
              </SubSection>
            )}

            {provenanceRepos.length > 0 && provenanceRepos[0] && (
              <SubSection title="Provenance Repository">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <DetailItem label="Utilization" value={provenanceRepos[0].utilization ?? 'N/A'} />
                  <DetailItem label="Used Space" value={provenanceRepos[0].used_space ?? 'N/A'} />
                  <DetailItem label="Free Space" value={provenanceRepos[0].free_space ?? 'N/A'} />
                  <DetailItem label="Total Space" value={provenanceRepos[0].total_space ?? 'N/A'} />
                </div>
              </SubSection>
            )}
          </div>

          {/* Garbage Collection */}
          {gcList.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Garbage Collection
              </h3>
              {gcList.map((gc, idx) => (
                <SubSection key={gc.name ?? gc.collection_time ?? 'unknown-gc'} title={gc.name ?? `GC ${idx + 1}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <DetailItem label="Collection Count" value={String(gc.collection_count ?? 'N/A')} />
                    <DetailItem label="Collection Time" value={String(gc.collection_time ?? 'N/A')} />
                  </div>
                </SubSection>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
