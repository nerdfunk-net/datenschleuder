'use client'

import { useCallback, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  Upload,
  Wand2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { parseNifiProperties, generateNifiProperties } from '../utils/nifi-properties-parser'
import { useNifiConfigMutations } from '../hooks/use-nifi-config-mutations'
import type { NifiProperty } from '../types'

type WizardStep = 'upload' | 'diff'
type DiffRowStatus = 'same' | 'modified' | 'new' | 'removed' | 'resolved'

interface DiffRow {
  key: string
  currentLineNumber: number | null
  uploadedLineNumber: number | null
  currentValue: string | null
  uploadedValue: string | null
  editedLeftValue: string
  status: DiffRowStatus
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: number | null
  instanceName: string
  currentRawContent: string
}

function computeDiff(currentRaw: string, uploadedRaw: string): DiffRow[] {
  const currentProps = parseNifiProperties(currentRaw)
  const uploadedProps = parseNifiProperties(uploadedRaw)

  const currentMap = new Map(currentProps.map((p) => [p.key, p]))
  const uploadedMap = new Map(uploadedProps.map((p) => [p.key, p]))

  const rows: DiffRow[] = []

  for (const up of uploadedProps) {
    const cur = currentMap.get(up.key)
    if (!cur) {
      rows.push({
        key: up.key,
        currentLineNumber: null,
        uploadedLineNumber: up.lineNumber,
        currentValue: null,
        uploadedValue: up.value,
        editedLeftValue: '',
        status: 'new',
      })
    } else if (cur.value !== up.value) {
      rows.push({
        key: up.key,
        currentLineNumber: cur.lineNumber,
        uploadedLineNumber: up.lineNumber,
        currentValue: cur.value,
        uploadedValue: up.value,
        editedLeftValue: cur.value,
        status: 'modified',
      })
    } else {
      rows.push({
        key: up.key,
        currentLineNumber: cur.lineNumber,
        uploadedLineNumber: up.lineNumber,
        currentValue: cur.value,
        uploadedValue: up.value,
        editedLeftValue: cur.value,
        status: 'same',
      })
    }
  }

  for (const cur of currentProps) {
    if (!uploadedMap.has(cur.key)) {
      rows.push({
        key: cur.key,
        currentLineNumber: cur.lineNumber,
        uploadedLineNumber: null,
        currentValue: cur.value,
        uploadedValue: null,
        editedLeftValue: '',
        status: 'removed',
      })
    }
  }

  return rows
}

export function UpdateWizardDialog({
  open,
  onOpenChange,
  repoId,
  instanceName,
  currentRawContent,
}: Props) {
  const [step, setStep] = useState<WizardStep>('upload')
  const [uploadedRawContent, setUploadedRawContent] = useState('')
  const [diffRows, setDiffRows] = useState<DiffRow[]>([])
  const [rightProperties, setRightProperties] = useState<NifiProperty[]>([])
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { writeConfigFile } = useNifiConfigMutations()

  const handleClose = useCallback(
    (value: boolean) => {
      if (!value) {
        setStep('upload')
        setUploadedRawContent('')
        setDiffRows([])
        setRightProperties([])
      }
      onOpenChange(value)
    },
    [onOpenChange]
  )

  const processUploadedFile = useCallback(
    (content: string) => {
      setUploadedRawContent(content)
      const rows = computeDiff(currentRawContent, content)
      setDiffRows(rows)
      setRightProperties(parseNifiProperties(content))
      setStep('diff')
    },
    [currentRawContent]
  )

  const handleFileSelect = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        processUploadedFile(content)
      }
      reader.readAsText(file)
    },
    [processUploadedFile]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleCopyToRight = useCallback((rowKey: string) => {
    setDiffRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row
        const valueToApply = row.editedLeftValue
        setRightProperties((props) =>
          props.map((p) =>
            p.lineNumber === row.uploadedLineNumber ? { ...p, value: valueToApply } : p
          )
        )
        return { ...row, uploadedValue: valueToApply, status: 'resolved' }
      })
    )
  }, [])

  const handleEditedLeftChange = useCallback((rowKey: string, value: string) => {
    setDiffRows((prev) =>
      prev.map((row) => (row.key === rowKey ? { ...row, editedLeftValue: value } : row))
    )
  }, [])

  const handleSave = useCallback(async () => {
    if (repoId == null) return
    const updatedContent = generateNifiProperties(uploadedRawContent, rightProperties)
    await writeConfigFile.mutateAsync({
      repoId,
      path: 'nifi.properties',
      content: updatedContent,
      commitMessage: `Update nifi.properties for ${instanceName} via Update Wizard`,
    })
    setShowSaveConfirm(false)
    handleClose(false)
  }, [repoId, uploadedRawContent, rightProperties, instanceName, writeConfigFile, handleClose])

  const counts = {
    modified: diffRows.filter((r) => r.status === 'modified').length,
    new: diffRows.filter((r) => r.status === 'new').length,
    removed: diffRows.filter((r) => r.status === 'removed').length,
    resolved: diffRows.filter((r) => r.status === 'resolved').length,
  }

  const pendingCount = counts.modified + counts.new

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="flex flex-col max-h-[92vh]"
          style={{ maxWidth: '95vw', width: '1600px' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Wand2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">Update Wizard</div>
                <DialogDescription className="text-gray-600 mt-0.5">
                  {instanceName}
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>

          {step === 'upload' ? (
            <UploadStep
              dragOver={dragOver}
              fileInputRef={fileInputRef}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onFileInputChange={handleFileInputChange}
              onBrowseClick={() => fileInputRef.current?.click()}
            />
          ) : (
            <DiffStep
              diffRows={diffRows}
              counts={counts}
              pendingCount={pendingCount}
              onCopyToRight={handleCopyToRight}
              onEditedLeftChange={handleEditedLeftChange}
              onBack={() => setStep('upload')}
              onSave={() => setShowSaveConfirm(true)}
              isSaving={writeConfigFile.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save New Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace <strong>nifi.properties</strong> with the new version
              (incorporating your edits) and push it to the git repository. This action cannot be
              undone without a manual git revert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={writeConfigFile.isPending}>
              {writeConfigFile.isPending && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              )}
              Yes, Save & Push
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Upload Step ──────────────────────────────────────────────────────────────

interface UploadStepProps {
  dragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBrowseClick: () => void
}

function UploadStep({
  dragOver,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  onBrowseClick,
}: UploadStepProps) {
  return (
    <div className="space-y-4 py-2">
      {/* Info alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Upload the original{' '}
          <code className="font-mono bg-blue-100 px-1 rounded text-xs">nifi.properties</code> from
          the NiFi distribution archive.{' '}
          <strong>Do not modify the file before uploading</strong> — it should be the unmodified
          default configuration from the new NiFi version. The wizard will help you migrate your
          existing values into the new file.
        </AlertDescription>
      </Alert>

      {/* Upload section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg">
          <Upload className="h-4 w-4" />
          <span className="text-sm font-medium">Upload New nifi.properties</span>
          <span className="text-xs text-blue-100 ml-auto">From the NiFi archive</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div
            className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed py-14 transition-colors cursor-pointer ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onBrowseClick}
          >
            <div
              className={`rounded-full p-4 ${dragOver ? 'bg-blue-100' : 'bg-gray-200'}`}
            >
              <Upload
                className={`h-8 w-8 ${dragOver ? 'text-blue-600' : 'text-gray-500'}`}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {dragOver ? 'Drop to upload' : 'Drag & drop or click to browse'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                nifi.properties — unmodified from the new NiFi archive
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".properties"
              className="hidden"
              onChange={onFileInputChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Diff Step ────────────────────────────────────────────────────────────────

interface DiffStepProps {
  diffRows: DiffRow[]
  counts: { modified: number; new: number; removed: number; resolved: number }
  pendingCount: number
  onCopyToRight: (key: string) => void
  onEditedLeftChange: (key: string, value: string) => void
  onBack: () => void
  onSave: () => void
  isSaving: boolean
}

function DiffStep({
  diffRows,
  counts,
  pendingCount,
  onCopyToRight,
  onEditedLeftChange,
  onBack,
  onSave,
  isSaving,
}: DiffStepProps) {
  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Summary */}
      <div className="flex items-center gap-2 flex-wrap">
        {counts.modified > 0 && (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            {counts.modified} modified
          </Badge>
        )}
        {counts.new > 0 && (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            {counts.new} new
          </Badge>
        )}
        {counts.removed > 0 && (
          <Badge variant="outline" className="text-gray-600">
            {counts.removed} removed
          </Badge>
        )}
        {counts.resolved > 0 && (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {counts.resolved} resolved
          </Badge>
        )}

        {pendingCount > 0 ? (
          <Alert className="ml-auto py-1 px-3 bg-amber-50 border-amber-200 flex items-center gap-2 w-auto">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <AlertDescription className="text-amber-800 text-xs">
              {pendingCount} row{pendingCount !== 1 ? 's' : ''} still need attention
            </AlertDescription>
          </Alert>
        ) : counts.resolved > 0 ? (
          <Alert className="ml-auto py-1 px-3 bg-green-50 border-green-200 flex items-center gap-2 w-auto">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <AlertDescription className="text-green-800 text-xs">
              All rows resolved
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      {/* Panel headers */}
      <div className="grid grid-cols-[1fr_48px_1fr] gap-2">
        <div className="shadow-sm border-0 p-0 bg-white rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2">
            <span className="text-sm font-medium">Current Version</span>
            <span className="text-xs text-blue-100 ml-auto">Your existing nifi.properties</span>
          </div>
        </div>
        <div />
        <div className="shadow-sm border-0 p-0 bg-white rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2">
            <span className="text-sm font-medium">Uploaded (New Version)</span>
            <span className="text-xs text-blue-100 ml-auto">Archive defaults</span>
          </div>
        </div>
      </div>

      {/* Column sub-headers */}
      <div className="grid grid-cols-[1fr_48px_1fr] gap-2 text-xs text-gray-500 font-medium px-2">
        <div className="grid grid-cols-[36px_1fr_200px] gap-1">
          <span>#</span>
          <span>Key</span>
          <span>Value</span>
        </div>
        <div />
        <div className="grid grid-cols-[36px_1fr_200px] gap-1">
          <span>#</span>
          <span>Key</span>
          <span>Value</span>
        </div>
      </div>

      {/* Diff rows */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {diffRows.map((row) => (
          <DiffRowItem
            key={row.key}
            row={row}
            onCopyToRight={onCopyToRight}
            onEditedLeftChange={onEditedLeftChange}
          />
        ))}
      </div>

      <DialogFooter className="border-t pt-4">
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            )}
            Save new Config
          </Button>
        </div>
      </DialogFooter>
    </div>
  )
}

// ─── Single Diff Row ──────────────────────────────────────────────────────────

interface DiffRowItemProps {
  row: DiffRow
  onCopyToRight: (key: string) => void
  onEditedLeftChange: (key: string, value: string) => void
}

function DiffRowItem({ row, onCopyToRight, onEditedLeftChange }: DiffRowItemProps) {
  const showArrow = (() => {
    if (row.uploadedLineNumber === null) return false
    if (row.status === 'new') return row.editedLeftValue.trim() !== ''
    return row.editedLeftValue !== row.uploadedValue
  })()

  const canCopy = showArrow && row.editedLeftValue.trim() !== ''

  const leftCellClass = (() => {
    switch (row.status) {
      case 'modified':
        return 'bg-green-50 border border-green-200'
      case 'removed':
        return 'bg-gray-50 border border-gray-200 opacity-60'
      case 'resolved':
        return 'bg-gray-100 border border-gray-200'
      default:
        return 'bg-white border border-gray-100'
    }
  })()

  const rightCellClass = (() => {
    switch (row.status) {
      case 'modified':
      case 'new':
        return 'bg-red-50 border border-red-200'
      case 'resolved':
        return 'bg-gray-100 border border-gray-200'
      default:
        return 'bg-white border border-gray-100'
    }
  })()


  return (
    <div className="grid grid-cols-[1fr_48px_1fr] gap-2 items-center">
      {/* Left (current) */}
      <div
        className={`grid grid-cols-[36px_1fr_200px] gap-1 items-center rounded px-2 py-1.5 ${leftCellClass}`}
      >
        <span className="text-xs text-gray-400 font-mono tabular-nums">
          {row.currentLineNumber ?? ''}
        </span>
        <span className="text-xs font-mono text-gray-700 truncate" title={row.key}>
          {row.key}
        </span>
        {row.status !== 'removed' ? (
          <Input
            value={row.editedLeftValue}
            onChange={(e) => onEditedLeftChange(row.key, e.target.value)}
            placeholder="Enter value…"
            className="h-6 text-xs font-mono bg-white"
          />
        ) : (
          <span className="text-xs font-mono truncate text-gray-400" title={row.currentValue ?? ''}>
            {row.currentValue ?? ''}
          </span>
        )}
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        {showArrow ? (
          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 rounded-full transition-colors ${
              canCopy
                ? 'text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            disabled={!canCopy}
            onClick={() => onCopyToRight(row.key)}
            title="Copy current value to new file"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="h-7 w-7" />
        )}
      </div>

      {/* Right (uploaded) */}
      <div
        className={`grid grid-cols-[36px_1fr_200px] gap-1 items-center rounded px-2 py-1.5 ${rightCellClass}`}
      >
        <span className="text-xs text-gray-400 font-mono tabular-nums">
          {row.uploadedLineNumber ?? ''}
        </span>
        <span className="text-xs font-mono text-gray-700 truncate" title={row.key}>
          {row.key}
        </span>
        <span
          className={`text-xs font-mono truncate ${
            row.status === 'resolved' ? 'text-gray-400' : 'text-gray-700'
          }`}
          title={row.uploadedValue ?? ''}
        >
          {row.uploadedValue ?? ''}
        </span>
      </div>
    </div>
  )
}
