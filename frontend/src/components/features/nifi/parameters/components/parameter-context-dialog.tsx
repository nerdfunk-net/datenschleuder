'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Link, Loader2, Home, RefreshCw } from 'lucide-react'
import { InheritanceDialog } from './inheritance-dialog'
import type { ParameterContext, ParameterContextForm, FormParameter, ModalMode } from '../types'
import type { NifiInstance } from '@/components/features/settings/nifi/types'

// Initial column widths in pixels: Name, Value, Description, Sensitive, Status
const INITIAL_COL_WIDTHS = [200, 220, 200, 80, 140]
const COL_MIN_WIDTH = 60

interface ParameterContextDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ModalMode
  form: ParameterContextForm
  onFormChange: (form: ParameterContextForm) => void
  instances: NifiInstance[]
  allContextsForInstance: ParameterContext[]
  isSaving: boolean
  onSave: () => void
}

export function ParameterContextDialog({
  open,
  onOpenChange,
  mode,
  form,
  onFormChange,
  instances,
  allContextsForInstance,
  isSaving,
  onSave,
}: ParameterContextDialogProps) {
  const [showInheritance, setShowInheritance] = useState(false)
  const [colWidths, setColWidths] = useState<number[]>(INITIAL_COL_WIDTHS)

  // Ref holds mutable resize state to avoid stale closures in event listeners
  const resizeRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null)

  const startResize = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    resizeRef.current = {
      colIndex,
      startX: e.clientX,
      startWidth: colWidths[colIndex] ?? INITIAL_COL_WIDTHS[colIndex] ?? COL_MIN_WIDTH,
    }

    function onMouseMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const { colIndex: ci, startX, startWidth } = resizeRef.current
      const newWidth = Math.max(COL_MIN_WIDTH, startWidth + (ev.clientX - startX))
      setColWidths((prev) => {
        const next = [...prev]
        next[ci] = newWidth
        return next
      })
    }

    function onMouseUp() {
      resizeRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [colWidths])

  const setField = useCallback(
    <K extends keyof ParameterContextForm>(key: K, value: ParameterContextForm[K]) => {
      onFormChange({ ...form, [key]: value })
    },
    [form, onFormChange],
  )

  const addParameter = useCallback(() => {
    onFormChange({
      ...form,
      parameters: [
        ...form.parameters,
        {
          _key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: '',
          value: '',
          description: '',
          sensitive: false,
          isExisting: false,
          isLocal: true,
          inheritedFrom: null,
          isOverridden: false,
        } satisfies FormParameter,
      ],
    })
  }, [form, onFormChange])

  const removeParameter = useCallback(
    (index: number) => {
      const next = [...form.parameters]
      next.splice(index, 1)
      onFormChange({ ...form, parameters: next })
    },
    [form, onFormChange],
  )

  const updateParameter = useCallback(
    (index: number, patch: Partial<FormParameter>) => {
      const next = form.parameters.map((p, i) => {
        if (i !== index) return p
        const updated = { ...p, ...patch }
        // Editing the value of an inherited-only param promotes it to local/overridden
        if ('value' in patch && !p.isLocal && p.inheritedFrom) {
          updated.isLocal = true
          updated.isOverridden = true
        }
        return updated
      })
      onFormChange({ ...form, parameters: next })
    },
    [form, onFormChange],
  )

  const handleInheritanceSave = useCallback(
    (inheritedIds: string[]) => {
      onFormChange({ ...form, inherited_parameter_contexts: inheritedIds })
    },
    [form, onFormChange],
  )

  const handleSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSave()
    },
    [onSave],
  )

  const colLabels = ['Name', 'Value', 'Description', 'Sensitive', 'Status'] as const

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-[92vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Create Parameter Context' : 'Edit Parameter Context'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Create a new parameter context for a NiFi instance.'
                : 'Edit the parameter context configuration.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* NiFi Instance (create only) */}
            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="instance">NiFi Instance</Label>
                <Select
                  value={form.instance_id?.toString() ?? ''}
                  onValueChange={(v) => setField('instance_id', v ? Number(v) : null)}
                >
                  <SelectTrigger id="instance">
                    <SelectValue placeholder="Select an instance..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id.toString()}>
                        {inst.hierarchy_attribute}={inst.hierarchy_value} ({inst.nifi_url})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="ctx-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ctx-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Enter parameter context name"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="ctx-desc">Description</Label>
              <Textarea
                id="ctx-desc"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={2}
                placeholder="Enter description (optional)"
              />
            </div>

            {/* Parameters table */}
            <div className="space-y-2">
              <Label>Parameters</Label>
              <div className="border border-gray-200 rounded-md overflow-auto">
                <table
                  className="text-sm"
                  style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: '100%' }}
                >
                  <colgroup>
                    {colLabels.map((label, i) => (
                      <col key={label} style={{ width: colWidths[i] }} />
                    ))}
                    {/* Delete column — fixed, not resizable */}
                    <col style={{ width: 40 }} />
                  </colgroup>

                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      {colLabels.map((label, i) => (
                        <th
                          key={label}
                          className="text-xs font-semibold text-gray-600 uppercase px-3 py-2 text-left select-none"
                          style={{ position: 'relative', overflow: 'hidden' }}
                        >
                          {label}
                          {/* Drag handle */}
                          <div
                            onMouseDown={(e) => startResize(i, e)}
                            style={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              bottom: 0,
                              width: 5,
                              cursor: 'col-resize',
                              userSelect: 'none',
                            }}
                            className="hover:bg-blue-400/60 transition-colors"
                          />
                        </th>
                      ))}
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>

                  <tbody>
                    {form.parameters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">
                          No parameters yet. Click &quot;Add Parameter&quot; to add one.
                        </td>
                      </tr>
                    ) : (
                      form.parameters.map((param, index) => (
                        <tr
                          key={param._key}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                        >
                          {/* Name */}
                          <td className="px-2 py-1.5">
                            <Input
                              value={param.name}
                              onChange={(e) => updateParameter(index, { name: e.target.value })}
                              disabled={param.isExisting && !param.isLocal}
                              placeholder="Name"
                              className="h-7 text-xs w-full"
                            />
                          </td>

                          {/* Value */}
                          <td className="px-2 py-1.5">
                            <Input
                              type={param.sensitive ? 'password' : 'text'}
                              value={param.value ?? ''}
                              onChange={(e) => updateParameter(index, { value: e.target.value })}
                              placeholder={param.sensitive ? 'Sensitive value' : 'Value'}
                              className="h-7 text-xs w-full"
                            />
                          </td>

                          {/* Description */}
                          <td className="px-2 py-1.5">
                            <Input
                              value={param.description ?? ''}
                              onChange={(e) =>
                                updateParameter(index, { description: e.target.value })
                              }
                              placeholder="Description"
                              className="h-7 text-xs w-full"
                            />
                          </td>

                          {/* Sensitive toggle */}
                          <td className="px-2 py-1.5 text-center">
                            <Switch
                              checked={param.sensitive}
                              onCheckedChange={(v) => updateParameter(index, { sensitive: v })}
                              className="scale-75"
                            />
                          </td>

                          {/* Status */}
                          <td className="px-2 py-1.5">
                            {param.inheritedFrom ? (
                              <Badge
                                className={
                                  param.isOverridden
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 text-xs'
                                    : 'bg-blue-100 text-blue-800 border-blue-300 text-xs'
                                }
                              >
                                {param.isOverridden ? (
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                ) : (
                                  <Link className="h-3 w-3 mr-1" />
                                )}
                                {param.isOverridden ? 'Overridden' : 'Inherited'}
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                                <Home className="h-3 w-3 mr-1" />
                                Local
                              </Badge>
                            )}
                          </td>

                          {/* Delete */}
                          <td className="px-2 py-1.5 text-right">
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-600"
                              onClick={() => removeParameter(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action buttons below table */}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addParameter}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Parameter
                </Button>
                {mode === 'edit' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInheritance(true)}
                  >
                    <Link className="h-4 w-4 mr-1" />
                    Edit Inheritance
                    {form.inherited_parameter_contexts.length > 0 && (
                      <Badge className="ml-1 bg-blue-100 text-blue-800 border-blue-300 text-xs">
                        {form.inherited_parameter_contexts.length}
                      </Badge>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inheritance Dialog */}
      <InheritanceDialog
        open={showInheritance}
        onOpenChange={setShowInheritance}
        allContexts={allContextsForInstance}
        inheritedIds={form.inherited_parameter_contexts}
        currentContextId={form.context_id}
        onSave={handleInheritanceSave}
      />
    </>
  )
}
