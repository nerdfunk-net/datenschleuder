'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useHierarchyValuesQuery } from '../hooks/use-hierarchy-query'
import { useHierarchyMutations } from '../hooks/use-hierarchy-mutations'
import type { HierarchyAttribute } from '../types'

interface Props {
  attribute: HierarchyAttribute | null
  readOnly: boolean
  onClose: () => void
}

export function AttributeValuesDialog({ attribute, readOnly, onClose }: Props) {
  const open = !!attribute
  const { data, isLoading } = useHierarchyValuesQuery(attribute?.name ?? '')
  const { saveValues } = useHierarchyMutations()

  const [localValues, setLocalValues] = useState<string[]>([])

  // Sync local values when data loads or attribute changes
  useEffect(() => {
    if (data) {
      setLocalValues(data.values ?? [])
    } else {
      setLocalValues([])
    }
  }, [data, attribute?.name])

  const handleAdd = () => setLocalValues(prev => [...prev, ''])

  const handleChange = (idx: number, value: string) => {
    setLocalValues(prev => prev.map((v, i) => (i === idx ? value : v)))
  }

  const handleRemove = (idx: number) => {
    setLocalValues(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!attribute) return
    const cleaned = localValues.filter(v => v.trim() !== '')
    await saveValues.mutateAsync({ attributeName: attribute.name, values: cleaned })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? 'View' : 'Edit'} Values —{' '}
            <span className="font-mono text-blue-600">{attribute?.name}</span>
            {attribute?.label && (
              <span className="text-sm font-normal text-slate-500 ml-2">({attribute.label})</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading values…
            </div>
          )}

          {!isLoading && localValues.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-4">No values defined yet</p>
          )}

          {!isLoading && localValues.map((value, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={value}
                readOnly={readOnly}
                placeholder="Enter value"
                onChange={e => handleChange(idx, e.target.value)}
                className="flex-1"
              />
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                  onClick={() => handleRemove(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {!readOnly && !isLoading && (
          <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Value
          </Button>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saveValues.isPending}>
              {saveValues.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Values
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
