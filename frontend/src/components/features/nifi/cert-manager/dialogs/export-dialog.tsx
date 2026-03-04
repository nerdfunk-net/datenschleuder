'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCertManagerMutations } from '../hooks/use-cert-manager-mutations'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
  filePath: string
  selectedIndices: number[]
  filePassword: string
}

export function ExportDialog({
  open,
  onOpenChange,
  instanceId,
  filePath,
  selectedIndices,
  filePassword,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'pem' | 'der' | 'p12'>('pem')
  const [password, setPassword] = useState(filePassword)

  const { exportCert } = useCertManagerMutations()

  const handleExport = () => {
    exportCert.mutate(
      {
        instance_id: instanceId,
        file_path: filePath,
        cert_indices: selectedIndices,
        format,
        password: password || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Certificates</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Selected certificates</Label>
            <p className="text-sm text-slate-700">{selectedIndices.length} certificate(s) selected</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="export-format">Export format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'pem' | 'der' | 'p12')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pem">PEM (text)</SelectItem>
                <SelectItem value="der">DER (binary)</SelectItem>
                <SelectItem value="p12">PKCS12 (.p12)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(format === 'p12') && (
            <div className="space-y-1">
              <Label htmlFor="export-password">P12 Password</Label>
              <Input
                id="export-password"
                type="password"
                placeholder="Password for the exported P12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exportCert.isPending}>
            {exportCert.isPending ? 'Exporting...' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
