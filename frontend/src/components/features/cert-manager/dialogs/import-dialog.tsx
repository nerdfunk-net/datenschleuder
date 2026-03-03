'use client'

import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCertManagerMutations } from '../hooks/use-cert-manager-mutations'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
}

export function ImportDialog({ open, onOpenChange, instanceId }: ImportDialogProps) {
  const [targetFilePath, setTargetFilePath] = useState('')
  const [password, setPassword] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { importCert } = useCertManagerMutations()

  const handleImport = () => {
    if (!selectedFile || !targetFilePath.trim()) return
    importCert.mutate(
      {
        instanceId,
        targetFilePath: targetFilePath.trim(),
        password: password || undefined,
        file: selectedFile,
      },
      { onSuccess: () => { onOpenChange(false); setSelectedFile(null) } }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Certificate</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Certificate file to upload</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              {selectedFile ? (
                <p className="text-sm text-slate-700 font-medium">{selectedFile.name}</p>
              ) : (
                <p className="text-sm text-slate-500">Click to select a .pem or .p12 file</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pem,.p12,.crt,.cer"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="target-path">Target path in repository</Label>
            <Input
              id="target-path"
              placeholder="e.g. certs/truststore.pem"
              value={targetFilePath}
              onChange={(e) => setTargetFilePath(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              PEM files are appended; P12 files replace the target entirely.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="import-password">Password (for encrypted P12 source)</Label>
            <Input
              id="import-password"
              type="password"
              placeholder="Leave blank if unencrypted"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedFile || !targetFilePath.trim() || importCert.isPending}
          >
            {importCert.isPending ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
