'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronRight, GripVertical, X, List, Download } from 'lucide-react'
import type { ParameterContext } from '../types'

interface InheritanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allContexts: ParameterContext[]
  /** IDs of currently inherited contexts in order */
  inheritedIds: string[]
  /** ID of the context being edited (excluded from available list) */
  currentContextId: string | null
  onSave: (inheritedIds: string[]) => void
}

export function InheritanceDialog({
  open,
  onOpenChange,
  allContexts,
  inheritedIds,
  currentContextId,
  onSave,
}: InheritanceDialogProps) {
  // Build initial lists from props on each open
  const buildLists = useCallback(() => {
    const inherited = inheritedIds
      .map((id) => allContexts.find((c) => c.id === id))
      .filter((c): c is ParameterContext => c !== undefined)

    const inheritedSet = new Set(inheritedIds)
    const available = allContexts.filter(
      (c) => c.id !== currentContextId && !inheritedSet.has(c.id),
    )
    return { inherited, available }
  }, [allContexts, inheritedIds, currentContextId])

  const [available, setAvailable] = useState<ParameterContext[]>(() => buildLists().available)
  const [inherited, setInherited] = useState<ParameterContext[]>(() => buildLists().inherited)

  // Reset lists each time the dialog opens
  useEffect(() => {
    if (!open) return
    const lists = buildLists()
    setAvailable(lists.available)
    setInherited(lists.inherited)
  }, [open, buildLists])

  // Drag state
  const dragRef = useRef<{ item: ParameterContext; from: 'available' | 'inherited' } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const onDragStart = useCallback((item: ParameterContext, from: 'available' | 'inherited') => {
    dragRef.current = { item, from }
    setDraggingId(item.id)
  }, [])

  const onDragEnd = useCallback(() => {
    dragRef.current = null
    setDraggingId(null)
  }, [])

  const onDragOverAvailable = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onDropOnAvailable = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!dragRef.current || dragRef.current.from !== 'inherited') return
      const item = dragRef.current.item
      setInherited((prev) => prev.filter((c) => c.id !== item.id))
      setAvailable((prev) => [...prev, item])
      dragRef.current = null
      setDraggingId(null)
    },
    [],
  )

  const onDropOnInherited = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!dragRef.current || dragRef.current.from !== 'available') return
      const item = dragRef.current.item
      setAvailable((prev) => prev.filter((c) => c.id !== item.id))
      setInherited((prev) => [...prev, item])
      dragRef.current = null
      setDraggingId(null)
    },
    [],
  )

  const onDropReorder = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragRef.current || dragRef.current.from !== 'inherited') return
    const item = dragRef.current.item
    setInherited((prev) => {
      const currentIndex = prev.findIndex((c) => c.id === item.id)
      if (currentIndex === -1 || currentIndex === targetIndex) return prev
      const next = [...prev]
      next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }, [])

  const removeFromInherited = useCallback((index: number) => {
    setInherited((prev) => {
      const removed = prev[index]
      if (removed) {
        setAvailable((avail) => [...avail, removed])
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const handleSave = useCallback(() => {
    onSave(inherited.map((c) => c.id))
    onOpenChange(false)
  }, [inherited, onSave, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl !important max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Parameter Context Inheritance</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 min-h-[500px] py-2">
          {/* Available contexts panel */}
          <div className="flex-1 flex flex-col">
            <div className="shadow-lg border-0 p-0 bg-white rounded-lg h-full flex flex-col">
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <List className="h-4 w-4" />
                  <span className="text-sm font-medium">Available Parameter Contexts</span>
                </div>
                <div className="text-xs text-blue-100">
                  {available.length} available
                </div>
              </div>
              <div
                className="flex-1 p-6 bg-gradient-to-b from-white to-gray-50 overflow-y-auto"
                onDragOver={onDragOverAvailable}
                onDrop={onDropOnAvailable}
              >
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50/50 min-h-[400px]">
                  {available.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 italic py-8">
                      All contexts are already inherited
                    </p>
                  ) : (
                    available.map((ctx) => (
                      <div
                        key={ctx.id}
                        draggable
                        onDragStart={() => onDragStart(ctx, 'available')}
                        onDragEnd={onDragEnd}
                        className={`flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 mb-2 cursor-move transition-all hover:border-blue-400 hover:shadow-sm ${draggingId === ctx.id ? 'opacity-40' : ''}`}
                      >
                        <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1">{ctx.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center px-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <ChevronRight className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          {/* Inherited contexts panel */}
          <div className="flex-1 flex flex-col">
            <div className="shadow-lg border-0 p-0 bg-white rounded-lg h-full flex flex-col">
              <div className="bg-gradient-to-r from-green-400/80 to-green-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span className="text-sm font-medium">Inherited (in order)</span>
                </div>
                <div className="text-xs text-green-100">
                  {inherited.length} inherited
                </div>
              </div>
              <div
                className="flex-1 p-6 bg-gradient-to-b from-white to-gray-50 overflow-y-auto"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropOnInherited}
              >
                <div className="border-2 border-dashed border-green-300 rounded-lg p-3 bg-green-50/30 min-h-[400px]">
                  {inherited.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 italic py-8">
                      Drag contexts here to inherit parameters
                    </p>
                  ) : (
                    inherited.map((ctx, index) => (
                      <div
                        key={ctx.id}
                        draggable
                        onDragStart={() => onDragStart(ctx, 'inherited')}
                        onDragEnd={onDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDropReorder(e, index)}
                        className={`flex items-center gap-2 bg-white border border-green-300 rounded-md px-3 py-2 mb-2 cursor-move transition-all hover:shadow-md hover:border-green-400 ${draggingId === ctx.id ? 'opacity-40' : ''}`}
                      >
                        <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1">{ctx.name}</span>
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded font-semibold">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-600 flex-shrink-0"
                          onClick={() => removeFromInherited(index)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
