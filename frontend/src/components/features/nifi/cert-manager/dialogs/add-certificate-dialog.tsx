'use client'

import { useState, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCertManagerMutations } from '../hooks/use-cert-manager-mutations'

const PEM_HEADER = '-----BEGIN CERTIFICATE-----'

interface AddCertificateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
  filePath: string
  filePassword: string
}

export function AddCertificateDialog({
  open,
  onOpenChange,
  instanceId,
  filePath,
  filePassword,
}: AddCertificateDialogProps) {
  const { addCertificate } = useCertManagerMutations()
  const [pastedPem, setPastedPem] = useState('')
  const [uploadedPem, setUploadedPem] = useState('')
  const [uploadedFilename, setUploadedFilename] = useState('')
  const [activeTab, setActiveTab] = useState('upload')

  const activePem = activeTab === 'paste' ? pastedPem : uploadedPem
  const isValid = activePem.includes(PEM_HEADER)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFilename(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setUploadedPem((ev.target?.result as string) ?? '')
    }
    reader.readAsText(file)
  }, [])

  function handleSubmit() {
    if (!isValid) return
    addCertificate.mutate(
      {
        instance_id: instanceId,
        file_path: filePath,
        cert_pem: activePem,
        password: filePassword || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          setPastedPem('')
          setUploadedPem('')
          setUploadedFilename('')
          setActiveTab('upload')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Certificate</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Add a PEM certificate to <span className="font-mono text-xs">{filePath}</span>. The change will be committed
          to git.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste PEM</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4 space-y-3">
            <Label htmlFor="cert-file">Certificate file (.pem, .crt, .cer)</Label>
            <label
              htmlFor="cert-file"
              className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-muted-foreground/60 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              {uploadedFilename ? (
                <span className="text-sm font-mono">{uploadedFilename}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Click to select or drop a file here</span>
              )}
              <input
                id="cert-file"
                type="file"
                accept=".pem,.crt,.cer"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {uploadedPem && !uploadedPem.includes(PEM_HEADER) && (
              <p className="text-xs text-destructive">File does not appear to contain a valid PEM certificate.</p>
            )}
          </TabsContent>

          <TabsContent value="paste" className="mt-4 space-y-3">
            <Label htmlFor="pem-textarea">PEM certificate text</Label>
            <Textarea
              id="pem-textarea"
              placeholder={`-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----`}
              className="font-mono text-xs h-40 resize-none"
              value={pastedPem}
              onChange={(e) => setPastedPem(e.target.value)}
            />
            {pastedPem && !pastedPem.includes(PEM_HEADER) && (
              <p className="text-xs text-destructive">Text must contain &apos;-----BEGIN CERTIFICATE-----&apos;.</p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || addCertificate.isPending}>
            {addCertificate.isPending ? 'Adding…' : 'Add Certificate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
