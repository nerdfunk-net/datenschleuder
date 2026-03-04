'use client'

import { useState } from 'react'
import { ArrowLeftRight, Download, Upload, KeySquare, Trash2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConvertDialog } from '../dialogs/convert-dialog'
import { ExportDialog } from '../dialogs/export-dialog'
import { ImportDialog } from '../dialogs/import-dialog'
import { CreateKeystoreDialog } from '../dialogs/create-keystore-dialog'
import { RemoveCertificateDialog } from '../dialogs/remove-certificate-dialog'
import { AddCertificateDialog } from '../dialogs/add-certificate-dialog'
import type { CertificateInfo } from '../types'

interface ActionsBarProps {
  instanceId: number | null
  filePath: string | null
  filePassword: string
  selectedIndices: number[]
  certificates?: CertificateInfo[]
}

export function ActionsBar({
  instanceId,
  filePath,
  filePassword,
  selectedIndices,
  certificates,
}: ActionsBarProps) {
  const [convertOpen, setConvertOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const hasCertSelected = selectedIndices.length > 0
  const hasFile = filePath !== null && instanceId !== null

  return (
    <>
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-slate-400/80 to-slate-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <span className="text-sm font-medium">Actions</span>
          {!hasCertSelected && hasFile && (
            <span className="text-xs text-slate-200">— select certificates to enable export</span>
          )}
        </div>
        <div className="p-4 bg-gradient-to-b from-white to-gray-50">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasFile}
              onClick={() => setConvertOpen(true)}
              className="flex items-center gap-2"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Convert
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!hasCertSelected}
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export ({selectedIndices.length})
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={instanceId === null}
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={instanceId === null}
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2"
            >
              <KeySquare className="h-4 w-4" />
              New Keystore / Truststore
            </Button>

            <Button
              variant="destructive"
              size="sm"
              disabled={!hasCertSelected || !hasFile}
              onClick={() => setRemoveOpen(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remove selected
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!hasFile}
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add certificate
            </Button>
          </div>
        </div>
      </div>

      {instanceId !== null && filePath !== null && (
        <ConvertDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          instanceId={instanceId}
          filePath={filePath}
          filePassword={filePassword}
        />
      )}

      {instanceId !== null && filePath !== null && hasCertSelected && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          instanceId={instanceId}
          filePath={filePath}
          selectedIndices={selectedIndices}
          filePassword={filePassword}
        />
      )}

      {instanceId !== null && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          instanceId={instanceId}
        />
      )}

      {instanceId !== null && (
        <CreateKeystoreDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          instanceId={instanceId}
        />
      )}

      {instanceId !== null && filePath !== null && hasCertSelected && (
        <RemoveCertificateDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          instanceId={instanceId}
          filePath={filePath}
          certIndices={selectedIndices}
          filePassword={filePassword}
          selectedCertificates={certificates?.filter((c) => selectedIndices.includes(c.index)) ?? []}
        />
      )}

      {instanceId !== null && filePath !== null && (
        <AddCertificateDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          instanceId={instanceId}
          filePath={filePath}
          filePassword={filePassword}
        />
      )}
    </>
  )
}
