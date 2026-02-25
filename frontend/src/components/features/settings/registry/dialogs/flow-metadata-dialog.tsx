'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Minus } from 'lucide-react'
import { useRegistryFlowMetadataQuery } from '../hooks/use-registry-flow-metadata-query'
import { useRegistryFlowMetadataMutations } from '../hooks/use-registry-flow-metadata-mutations'
import type { RegistryFlow, FlowMetadataItem } from '../types'

interface Props {
  flow: RegistryFlow | null
  onClose: () => void
}

function makeItem(is_mandatory: boolean): FlowMetadataItem {
  return {
    _clientKey: `${Date.now()}-${Math.random()}`,
    key: '',
    value: '',
    is_mandatory,
  }
}

function toFormItems(
  data: { key: string; value: string; is_mandatory: boolean }[]
): FlowMetadataItem[] {
  return data.map(d => ({
    _clientKey: `${Date.now()}-${Math.random()}`,
    key: d.key,
    value: d.value,
    is_mandatory: d.is_mandatory,
  }))
}

export function FlowMetadataDialog({ flow, onClose }: Props) {
  const open = !!flow
  const flowId = flow?.id ?? null

  const { data, isLoading } = useRegistryFlowMetadataQuery(flowId)
  const { setMetadata } = useRegistryFlowMetadataMutations()

  const [mandatory, setMandatory] = useState<FlowMetadataItem[]>([])
  const [optional, setOptional] = useState<FlowMetadataItem[]>([])

  // Reset form whenever dialog opens with new data
  useEffect(() => {
    if (open && data) {
      setMandatory(toFormItems(data.filter(d => d.is_mandatory)))
      setOptional(toFormItems(data.filter(d => !d.is_mandatory)))
    } else if (open && !isLoading) {
      setMandatory([])
      setOptional([])
    }
  }, [open, data, isLoading])

  const addMandatory = useCallback(() => {
    setMandatory(prev => [...prev, makeItem(true)])
  }, [])

  const addOptional = useCallback(() => {
    setOptional(prev => [...prev, makeItem(false)])
  }, [])

  const removeMandatory = useCallback((clientKey: string) => {
    setMandatory(prev => prev.filter(i => i._clientKey !== clientKey))
  }, [])

  const removeOptional = useCallback((clientKey: string) => {
    setOptional(prev => prev.filter(i => i._clientKey !== clientKey))
  }, [])

  const updateMandatory = useCallback((clientKey: string, field: 'key' | 'value', val: string) => {
    setMandatory(prev => prev.map(i => i._clientKey === clientKey ? { ...i, [field]: val } : i))
  }, [])

  const updateOptional = useCallback((clientKey: string, field: 'key' | 'value', val: string) => {
    setOptional(prev => prev.map(i => i._clientKey === clientKey ? { ...i, [field]: val } : i))
  }, [])

  const hasBlankKey = [...mandatory, ...optional].some(i => i.key.trim() === '')

  const handleSave = useCallback(async () => {
    if (!flowId) return
    const items = [
      ...mandatory.map(({ key, value, is_mandatory }) => ({ key, value, is_mandatory })),
      ...optional.map(({ key, value, is_mandatory }) => ({ key, value, is_mandatory })),
    ]
    await setMetadata.mutateAsync({ flowId, items })
    onClose()
  }, [flowId, mandatory, optional, setMetadata, onClose])

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Flow Metadata — {flow?.flow_name}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mandatory Properties */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between">
                <span className="text-sm font-medium">Mandatory Properties</span>
                <span className="text-xs text-blue-100">{mandatory.length} item{mandatory.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="p-4 space-y-2 bg-gradient-to-b from-white to-gray-50">
                {mandatory.map(item => (
                  <div key={item._clientKey} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      value={item.key}
                      onChange={e => updateMandatory(item._clientKey, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={item.value}
                      onChange={e => updateMandatory(item._clientKey, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                      onClick={() => removeMandatory(item._clientKey)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addMandatory} className="mt-1">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Property
                </Button>
              </div>
            </div>

            {/* Optional Properties */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-gradient-to-r from-slate-400/80 to-slate-500/80 text-white py-2 px-4 flex items-center justify-between">
                <span className="text-sm font-medium">Optional Properties</span>
                <span className="text-xs text-slate-200">{optional.length} item{optional.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="p-4 space-y-2 bg-gradient-to-b from-white to-gray-50">
                {optional.map(item => (
                  <div key={item._clientKey} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      value={item.key}
                      onChange={e => updateOptional(item._clientKey, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={item.value}
                      onChange={e => updateOptional(item._clientKey, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                      onClick={() => removeOptional(item._clientKey)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOptional} className="mt-1">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Property
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || setMetadata.isPending || hasBlankKey}
          >
            {setMetadata.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
