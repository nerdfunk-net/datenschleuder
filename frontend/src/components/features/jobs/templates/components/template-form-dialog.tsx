'use client'

import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Edit } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useTemplateMutations } from '../hooks/use-template-mutations'
import { JobTemplateCommonFields } from '../../components/JobTemplateCommonFields'
import { CheckQueuesFields } from './check-queues-fields'
import { CheckProgressGroupFields } from './check-progress-group-fields'
import type { ExpectedStatus } from './check-progress-group-fields'
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

  // Common form state
  const [formName, setFormName] = useState("")
  const [formJobType, setFormJobType] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formIsGlobal, setFormIsGlobal] = useState(false)

  // check_queues specific state: null = all clusters, array = specific cluster IDs
  const [nifiClusterIds, setNifiClusterIds] = useState<number[] | null>(null)
  const [checkMode, setCheckMode] = useState<'count' | 'bytes' | 'both'>('count')
  const [countYellow, setCountYellow] = useState(1000)
  const [countRed, setCountRed] = useState(10000)
  const [bytesYellow, setBytesYellow] = useState(10)
  const [bytesRed, setBytesRed] = useState(100)

  // check_progress_group specific state
  const [pgNifiClusterId, setPgNifiClusterId] = useState<number | null>(null)
  const [pgProcessGroupId, setPgProcessGroupId] = useState<string | null>(null)
  const [pgProcessGroupPath, setPgProcessGroupPath] = useState<string | null>(null)
  const [pgCheckChildren, setPgCheckChildren] = useState(true)
  const [pgExpectedStatus, setPgExpectedStatus] = useState<ExpectedStatus>('Running')

  const resetForm = useCallback(() => {
    setFormName("")
    setFormJobType("")
    setFormDescription("")
    setFormIsGlobal(false)
    setNifiClusterIds(null)
    setCheckMode('count')
    setCountYellow(1000)
    setCountRed(10000)
    setBytesYellow(10)
    setBytesRed(100)
    setPgNifiClusterId(null)
    setPgProcessGroupId(null)
    setPgProcessGroupPath(null)
    setPgCheckChildren(true)
    setPgExpectedStatus('Running')
  }, [])

  // Load editing template data
  useEffect(() => {
    if (open && editingTemplate) {
      setFormName(editingTemplate.name)
      setFormJobType(editingTemplate.job_type)
      setFormDescription(editingTemplate.description || "")
      setFormIsGlobal(editingTemplate.is_global)
      // Restore nifi_cluster_ids: undefined/null → null (all), array → specific
      setNifiClusterIds(editingTemplate.nifi_cluster_ids ?? null)
      setCheckMode((editingTemplate.check_queues_mode as 'count' | 'bytes' | 'both') ?? 'count')
      setCountYellow(editingTemplate.check_queues_count_yellow ?? 1000)
      setCountRed(editingTemplate.check_queues_count_red ?? 10000)
      setBytesYellow(editingTemplate.check_queues_bytes_yellow ?? 10)
      setBytesRed(editingTemplate.check_queues_bytes_red ?? 100)
      setPgNifiClusterId(editingTemplate.check_progress_group_nifi_cluster_id ?? null)
      setPgProcessGroupId(editingTemplate.check_progress_group_process_group_id ?? null)
      setPgProcessGroupPath(editingTemplate.check_progress_group_process_group_path ?? null)
      setPgCheckChildren(editingTemplate.check_progress_group_check_children ?? true)
      setPgExpectedStatus((editingTemplate.check_progress_group_expected_status as ExpectedStatus) ?? 'Running')
    } else if (open && !editingTemplate) {
      resetForm()
    }
  }, [open, editingTemplate, resetForm])

  const isFormValid = useCallback(() => {
    if (!formName.trim() || !formJobType) return false
    // check_queues: warn but don't block (user may intentionally select 0 for later)
    return true
  }, [formName, formJobType])

  const handleSubmit = async () => {
    const basePayload = {
      name: formName,
      job_type: formJobType,
      description: formDescription || undefined,
      is_global: formIsGlobal,
      inventory_source: "all" as const,
    }

    // Add type-specific fields
    const payload =
      formJobType === "check_queues"
        ? {
            ...basePayload,
            nifi_cluster_ids: nifiClusterIds,
            check_queues_mode: checkMode,
            check_queues_count_yellow: countYellow,
            check_queues_count_red: countRed,
            check_queues_bytes_yellow: bytesYellow,
            check_queues_bytes_red: bytesRed,
          }
        : formJobType === "check_progress_group"
          ? {
              ...basePayload,
              check_progress_group_nifi_cluster_id: pgNifiClusterId,
              check_progress_group_process_group_id: pgProcessGroupId,
              check_progress_group_process_group_path: pgProcessGroupPath,
              check_progress_group_check_children: pgCheckChildren,
              check_progress_group_expected_status: pgExpectedStatus,
            }
          : basePayload

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

          {/* Job-type specific sections */}
          {formJobType === "check_queues" && (
            <CheckQueuesFields
              nifiClusterIds={nifiClusterIds}
              onNifiClusterIdsChange={setNifiClusterIds}
              checkMode={checkMode}
              onCheckModeChange={setCheckMode}
              countYellow={countYellow}
              onCountYellowChange={setCountYellow}
              countRed={countRed}
              onCountRedChange={setCountRed}
              bytesYellow={bytesYellow}
              onBytesYellowChange={setBytesYellow}
              bytesRed={bytesRed}
              onBytesRedChange={setBytesRed}
            />
          )}

          {formJobType === "check_progress_group" && (
            <CheckProgressGroupFields
              nifiClusterId={pgNifiClusterId}
              onNifiClusterIdChange={setPgNifiClusterId}
              processGroupId={pgProcessGroupId}
              processGroupPath={pgProcessGroupPath}
              onProcessGroupChange={(id, path) => {
                setPgProcessGroupId(id)
                setPgProcessGroupPath(path)
              }}
              checkChildren={pgCheckChildren}
              onCheckChildrenChange={setPgCheckChildren}
              expectedStatus={pgExpectedStatus}
              onExpectedStatusChange={setPgExpectedStatus}
            />
          )}
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
