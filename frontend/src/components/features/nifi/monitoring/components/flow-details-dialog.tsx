'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from 'lucide-react'
import type { Flow, FlowType, FlowStatus } from '../types'

interface FlowDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flow: Flow | null
  flowType: FlowType | null
  status: FlowStatus
  statusText: string
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col p-3 bg-white rounded-md border-l-4 border-blue-400">
      <span className="text-xs text-gray-500 font-medium mb-1">{label}</span>
      <span className="text-sm font-semibold text-slate-900 break-words">{value}</span>
    </div>
  )
}

const STATUS_BADGE_CLASSES: Record<FlowStatus, string> = {
  healthy: 'bg-green-100 text-green-800 border-green-300',
  unhealthy: 'bg-red-100 text-red-800 border-red-300',
  warning: 'bg-amber-100 text-amber-800 border-amber-300',
  unknown: 'bg-gray-100 text-gray-800 border-gray-300',
}

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}

export function FlowDetailsDialog({
  open,
  onOpenChange,
  flow,
  flowType,
  status,
  statusText,
}: FlowDetailsDialogProps) {
  if (!flow) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-blue-600" />
            Flow Details
            {flowType && (
              <Badge
                className={
                  flowType === 'source'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-purple-100 text-purple-800 border-purple-300'
                }
              >
                {flowType === 'source' ? 'Source' : 'Destination'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Flow Information */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
              Flow Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {flow.name && <DetailItem label="Flow Name" value={flow.name} />}
              <DetailItem label="Bucket" value={flow.bucket_name} />
              <DetailItem label="Registry" value={flow.registry_name} />
              <DetailItem label="Version" value={String(flow.version)} />
              <DetailItem label="Flow ID" value={flow.flow_id} />
              <div className="flex flex-col p-3 bg-white rounded-md border-l-4 border-blue-400">
                <span className="text-xs text-gray-500 font-medium mb-1">Status</span>
                <Badge className={STATUS_BADGE_CLASSES[status]}>{statusText}</Badge>
              </div>
            </div>
          </div>

          {/* Connection Parameters */}
          {(flow.src_connection_param || flow.dest_connection_param) && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
                Connection Parameters
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {flow.src_connection_param && (
                  <DetailItem label="Source Connection" value={flow.src_connection_param} />
                )}
                {flow.dest_connection_param && (
                  <DetailItem label="Destination Connection" value={flow.dest_connection_param} />
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-gray-200">
              Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DetailItem label="Created" value={formatDate(flow.created_at)} />
              <DetailItem label="Last Updated" value={formatDate(flow.updated_at)} />
            </div>
          </div>
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
