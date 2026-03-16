'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useApi } from '@/hooks/use-api'

type StoreType = 'keystore' | 'truststore'
type StoreFormat = 'pkcs12' | 'pem'

interface UploadStoreResult {
  filename: string
  subject: string
  issuer: string
  is_expired: boolean
  fingerprint_sha256: string
  commit_sha: string
}

interface UploadStoreDialogProps {
  open: boolean
  instanceName: string
  gitRepoId: number
  onClose: () => void
  onUploaded: (storeType: StoreType, result: UploadStoreResult, password: string) => void
}

export function UploadStoreDialog({
  open,
  instanceName,
  gitRepoId,
  onClose,
  onUploaded,
}: UploadStoreDialogProps) {
  const { apiCall } = useApi()

  const [storeType, setStoreType] = useState<StoreType>('keystore')
  const [storeFormat, setStoreFormat] = useState<StoreFormat>('pkcs12')
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadStoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setStoreType('keystore')
    setStoreFormat('pkcs12')
    setPassword('')
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  const handleUpload = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('git_repo_id', String(gitRepoId))
      formData.append('store_type', storeType)
      formData.append('store_format', storeFormat)
      formData.append('password', password)
      formData.append('file', file)

      const data = await apiCall<UploadStoreResult>('nifi/certificates/upload-store', {
        method: 'POST',
        body: formData,
      })

      setResult(data)
      onUploaded(storeType, data, password)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }, [file, gitRepoId, storeType, storeFormat, password, apiCall, onUploaded])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Store</DialogTitle>
          <DialogDescription>
            Upload a keystore or truststore for <strong>{instanceName}</strong>. The file will be
            committed and pushed to the associated git repository.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Store type */}
          <div className="space-y-1">
            <Label>Store Type</Label>
            <Select
              value={storeType}
              onValueChange={(v) => setStoreType(v as StoreType)}
              disabled={loading || result !== null}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keystore">Keystore</SelectItem>
                <SelectItem value="truststore">Truststore</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Store format */}
          <div className="space-y-1">
            <Label>Store Format</Label>
            <Select
              value={storeFormat}
              onValueChange={(v) => setStoreFormat(v as StoreFormat)}
              disabled={loading || result !== null}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pkcs12">PKCS12 (.p12)</SelectItem>
                <SelectItem value="pem">PEM (.pem)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="upload-password">
              Password{storeFormat === 'pem' ? ' (optional)' : ''}
            </Label>
            <Input
              id="upload-password"
              type="password"
              placeholder="store password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || result !== null}
            />
            <p className="text-xs text-muted-foreground">
              This password will be saved and used in nifi.properties.
            </p>
          </div>

          {/* File picker */}
          <div className="space-y-1">
            <Label>File</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept={storeFormat === 'pkcs12' ? '.p12' : '.pem'}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={loading || result !== null}
                className="flex-1"
              />
            </div>
            {file && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{file.name}</span> (
                {(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-xs">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="font-medium text-green-800">
                  {result.filename} uploaded successfully
                </span>
              </div>
              <div className="pl-6 space-y-0.5 text-green-700">
                <div>
                  <span className="font-medium">Subject: </span>
                  <span className="break-all">{result.subject}</span>
                </div>
                <div>
                  <span className="font-medium">Issuer: </span>
                  <span className="break-all">{result.issuer}</span>
                </div>
                {result.is_expired && (
                  <div className="text-amber-600 font-medium">Warning: certificate is expired</div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={loading || !file}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
