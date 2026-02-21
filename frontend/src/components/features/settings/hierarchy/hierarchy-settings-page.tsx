'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Eye,
  Pencil,
  Loader2,
  RotateCcw,
  GitBranch,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import { useHierarchyQuery, useHierarchyFlowCountQuery } from './hooks/use-hierarchy-query'
import { useHierarchyMutations } from './hooks/use-hierarchy-mutations'
import { AttributeValuesDialog } from './dialogs/attribute-values-dialog'
import type { HierarchyAttributeEditing, HierarchyAttribute } from './types'

export function HierarchySettingsPage() {
  const { user } = useAuthStore()
  const canWrite = hasPermission(user, 'nifi.settings', 'write')

  const { data, isLoading } = useHierarchyQuery()
  const { data: flowCountData } = useHierarchyFlowCountQuery()
  const { saveConfig } = useHierarchyMutations()

  const existingFlowCount = flowCountData?.count ?? 0

  const [attrs, setAttrs] = useState<HierarchyAttributeEditing[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [valuesAttr, setValuesAttr] = useState<HierarchyAttribute | null>(null)
  const [valuesReadOnly, setValuesReadOnly] = useState(false)

  useEffect(() => {
    if (data) {
      setAttrs(
        [...data.hierarchy]
          .sort((a, b) => a.order - b.order)
          .map(a => ({ ...a }))
      )
      setIsDirty(false)
    }
  }, [data])

  const markDirty = useCallback(() => setIsDirty(true), [])

  const validateUniqueName = useCallback((index: number, list: HierarchyAttributeEditing[]) => {
    const current = list[index]
    if (!current) return list
    const updated = [...list]
    const trimmed = current.name.trim().toUpperCase()

    if (!trimmed) {
      updated[index] = { ...current, nameError: 'Name is required' }
      return updated
    }

    const count = updated.filter(a => a.name.trim().toUpperCase() === trimmed).length
    updated[index] = {
      ...current,
      nameError: count > 1 ? 'Duplicate name — must be unique' : undefined,
    }
    return updated
  }, [])

  const handleNameChange = useCallback((index: number, value: string) => {
    setAttrs(prev => {
      const updated = prev.map((a, i) => (i === index ? { ...a, name: value } : a))
      return validateUniqueName(index, updated)
    })
    markDirty()
  }, [validateUniqueName, markDirty])

  const handleLabelChange = useCallback((index: number, value: string) => {
    setAttrs(prev => prev.map((a, i) => (i === index ? { ...a, label: value } : a)))
    markDirty()
  }, [markDirty])

  const handleAdd = useCallback(() => {
    setAttrs(prev => [
      ...prev,
      { name: '', label: '', order: prev.length },
    ])
    markDirty()
  }, [markDirty])

  const handleRemove = useCallback((index: number) => {
    setAttrs(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((a, i) => ({ ...a, order: i }))
    )
    markDirty()
  }, [markDirty])

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    setAttrs(prev => {
      const updated = [...prev]
      const tmp = updated[index - 1]!
      updated[index - 1] = updated[index]!
      updated[index] = tmp
      return updated.map((a, i) => ({ ...a, order: i }))
    })
    markDirty()
  }, [markDirty])

  const handleMoveDown = useCallback((index: number) => {
    setAttrs(prev => {
      if (index >= prev.length - 1) return prev
      const updated = [...prev]
      const tmp = updated[index]!
      updated[index] = updated[index + 1]!
      updated[index + 1] = tmp
      return updated.map((a, i) => ({ ...a, order: i }))
    })
    markDirty()
  }, [markDirty])

  const handleReset = useCallback(() => {
    if (data) {
      setAttrs(
        [...data.hierarchy]
          .sort((a, b) => a.order - b.order)
          .map(a => ({ ...a }))
      )
      setIsDirty(false)
    }
  }, [data])

  const hasErrors = useMemo(() => attrs.some(a => !!a.nameError), [attrs])

  const handleSaveClick = useCallback(() => {
    let list = [...attrs]
    attrs.forEach((_, i) => { list = validateUniqueName(i, list) })
    setAttrs(list)
    if (list.some(a => !!a.nameError)) return
    setShowConfirm(true)
  }, [attrs, validateUniqueName])

  const handleConfirmSave = useCallback(async () => {
    setShowConfirm(false)
    await saveConfig.mutateAsync({
      hierarchy: attrs.map(({ nameError: _e, ...a }) => a),
    })
    setIsDirty(false)
  }, [attrs, saveConfig])

  const preview = useMemo(() => {
    if (attrs.length === 0) return 'No attributes defined'
    const examples: Record<string, string> = { CN: 'test', O: 'myOrg', OU: 'myOrgUnit', DC: 'myNet' }
    return attrs
      .map(a => `${a.name || '?'}=${examples[a.name] ?? 'value'}`)
      .join(',')
  }, [attrs])

  const pageHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-purple-100 p-2 rounded-lg">
          <GitBranch className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hierarchy Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure the attribute hierarchy (e.g.,{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">CN=test,O=myOrg,OU=myOrgUnit</code>)
          </p>
        </div>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        {pageHeader}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {pageHeader}

      {/* Attribute Configuration Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-4 w-4" />
            <span className="text-sm font-medium">Attribute Configuration</span>
          </div>
          <div className="text-xs text-blue-100">
            {attrs.length} attribute{attrs.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <p className="text-xs text-gray-500 mb-3">
            Define the order of attributes from top (first) to bottom (last). Each attribute name must be unique.
          </p>

          <div className="space-y-3">
            {attrs.map((attr, index) => (
              <div
                key={attr.name || index}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                {/* Order badge */}
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mt-0.5">
                  {index + 1}
                </div>

                {/* Fields */}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      value={attr.name}
                      placeholder="Name (e.g., CN)"
                      disabled={!canWrite}
                      onChange={e => handleNameChange(index, e.target.value)}
                      className={attr.nameError ? 'border-red-400 focus-visible:ring-red-400' : ''}
                    />
                    {attr.nameError && (
                      <p className="text-xs text-red-500 mt-1">{attr.nameError}</p>
                    )}
                  </div>
                  <Input
                    value={attr.label}
                    placeholder="Label (e.g., Common Name)"
                    disabled={!canWrite}
                    onChange={e => handleLabelChange(index, e.target.value)}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600"
                    title="View values"
                    disabled={!attr.name}
                    onClick={() => { setValuesAttr(attr); setValuesReadOnly(true) }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600"
                      title="Edit values"
                      disabled={!attr.name}
                      onClick={() => { setValuesAttr(attr); setValuesReadOnly(false) }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                      title="Remove attribute"
                      disabled={attrs.length === 1}
                      onClick={() => handleRemove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Move up/down */}
                {canWrite && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                      disabled={index === attrs.length - 1}
                      onClick={() => handleMoveDown(index)}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {canWrite && (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Attribute
            </Button>
          )}
        </div>
      </div>

      {/* Preview Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">Preview</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 break-all">
            {preview}
          </div>
          <p className="text-xs text-gray-500 mt-1">Example output with sample values</p>
        </div>
      </div>

      {/* Footer actions */}
      {canWrite && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty || saveConfig.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={!isDirty || hasErrors || saveConfig.isPending}
          >
            {saveConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      )}

      {/* Double-confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Warning — Destructive Change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Changing the hierarchy format will affect all NiFi flows and instances
                  that depend on hierarchy attribute/value mappings.
                </p>
                {existingFlowCount > 0 ? (
                  <p className="font-semibold text-red-600">
                    {existingFlowCount} existing flow{existingFlowCount !== 1 ? 's' : ''} will
                    be permanently deleted. This action cannot be undone.
                  </p>
                ) : (
                  <p className="font-semibold text-slate-700">
                    This action cannot be undone.
                  </p>
                )}
                <p>Are you sure you want to proceed?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Values dialog */}
      <AttributeValuesDialog
        attribute={valuesAttr}
        readOnly={valuesReadOnly}
        onClose={() => setValuesAttr(null)}
      />
    </div>
  )
}
