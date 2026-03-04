'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCertManagerMutations } from '../hooks/use-cert-manager-mutations'

interface ConvertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
  filePath: string
  filePassword: string
}

export function ConvertDialog({
  open,
  onOpenChange,
  instanceId,
  filePath,
  filePassword,
}: ConvertDialogProps) {
  const srcExt = filePath.split('.').pop()?.toLowerCase() ?? ''
  const defaultTarget = srcExt === 'p12' ? 'pem' : 'p12'

  const [targetFormat, setTargetFormat] = useState<'pem' | 'p12'>(defaultTarget as 'pem' | 'p12')
  const [outputFilename, setOutputFilename] = useState('')
  const [password, setPassword] = useState(filePassword)

  const { convertCert } = useCertManagerMutations()

  const handleConvert = () => {
    if (!outputFilename.trim()) return
    convertCert.mutate(
      {
        instance_id: instanceId,
        file_path: filePath,
        target_format: targetFormat,
        output_filename: outputFilename.trim(),
        password: password || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Certificate</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Source file</Label>
            <p className="text-sm font-mono text-slate-700">{filePath}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="target-format">Target format</Label>
            <Select value={targetFormat} onValueChange={(v) => setTargetFormat(v as 'pem' | 'p12')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pem">PEM (.pem)</SelectItem>
                <SelectItem value="p12">PKCS12 (.p12)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="output-filename">Output filename (relative to repo root)</Label>
            <Input
              id="output-filename"
              placeholder={`e.g. certs/converted.${targetFormat}`}
              value={outputFilename}
              onChange={(e) => setOutputFilename(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="conv-password">Password (for P12 source or output)</Label>
            <Input
              id="conv-password"
              type="password"
              placeholder="Leave blank if none"
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
            onClick={handleConvert}
            disabled={!outputFilename.trim() || convertCert.isPending}
          >
            {convertCert.isPending ? 'Converting...' : 'Convert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
