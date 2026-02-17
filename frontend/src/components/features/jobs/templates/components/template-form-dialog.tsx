'use client'

import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Edit } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { JobTemplateCommonFields } from '../../components/JobTemplateCommonFields'
import type { JobTemplate } from '../types'

interface TemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTemplate: JobTemplate | null
  onSaved: () => void
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  editingTemplate,
  onSaved
}: TemplateFormDialogProps) {
  const user = useAuthStore(state => state.user)
  const { createTemplate, updateTemplate } = useTemplateMutations()

  // Form state - simplified for example type only
  const [formName, setFormName] = useState("")
  const [formJobType, setFormJobType] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formIsGlobal, setFormIsGlobal] = useState(false)

  const resetForm = useCallback(() => {
    setFormName("")
    setFormJobType("")
    setFormDescription("")
    setFormIsGlobal(false)
  }, [])

  // Load editing template data
  useEffect(() => {
    if (open && editingTemplate) {
      setFormName(editingTemplate.name)
      setFormJobType(editingTemplate.job_type)
      setFormDescription(editingTemplate.description || "")
      setFormIsGlobal(editingTemplate.is_global)
    } else if (open && !editingTemplate) {
      resetForm()
    }
  }, [open, editingTemplate, resetForm])

  const isFormValid = useCallback(() => {
    if (!formName.trim() || !formJobType) return false
    return true
  }, [formName, formJobType])

  const handleSubmit = async () => {
    const payload = {
      name: formName,
      job_type: formJobType,
      description: formDescription || undefined,
      is_global: formIsGlobal,
      inventory_source: "all" as const, // Default for simplified example type
    }

    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, data: payload })
    } else {
      await createTemplate.mutateAsync(payload)
    }

    onSaved()
    onOpenChange(false)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl sm:!max-w-6xl p-0 gap-0 overflow-hidden w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-6 py-4">
          <DialogHeader className="text-white">
            <DialogTitle className="text-lg font-semibold text-white">
              {editingTemplate ? "Edit Job Template" : "Create Job Template"}
            </DialogTitle>
            <DialogDescription className="text-blue-50">
              {editingTemplate ? "Update job template settings" : "Create a new reusable job template"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Common Fields */}
          <JobTemplateCommonFields
            formName={formName}
            setFormName={setFormName}
            formJobType={formJobType}
            setFormJobType={setFormJobType}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formIsGlobal={formIsGlobal}
            setFormIsGlobal={setFormIsGlobal}
            user={user}
            editingTemplate={!!editingTemplate}
          />

          {/* No job-specific sections for example type */}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-3 bg-gray-50 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              resetForm()
            }}
            className="h-9 px-4 border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || createTemplate.isPending || updateTemplate.isPending}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {editingTemplate ? (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Update Template
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
