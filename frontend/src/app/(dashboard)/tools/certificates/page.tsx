'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  KeyRound,
  Upload,
  FolderSearch,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
  Info,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface CertificateInfo {
  filename: string
  path: string
  size: number
  exists_in_system: boolean
}

interface ScanResponse {
  success: boolean
  certificates: CertificateInfo[]
  certs_directory: string
  message?: string
}

interface UploadResponse {
  success: boolean
  message: string
  filename: string
}

interface AddCertificateResponse {
  success: boolean
  message: string
  output?: string
  error?: string
  command_output?: string
}

export default function AddCertificatePage() {
  const [certificates, setCertificates] = useState<CertificateInfo[]>([])
  const [selectedCerts, setSelectedCerts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [certsDirectory, setCertsDirectory] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modal state for command output
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalOutput, setModalOutput] = useState('')
  const [modalSuccess, setModalSuccess] = useState(true)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { apiCall } = useApi()
  const { toast } = useToast()

  const scanCertificates = useCallback(async () => {
    setScanning(true)
    setError(null)

    try {
      const data = await apiCall<ScanResponse>('certificates/scan', { method: 'GET' })

      if (data.success) {
        setCertificates(data.certificates)
        setCertsDirectory(data.certs_directory)
        setSuccessMessage(data.message || null)
      } else {
        setError(data.message || 'Failed to scan certificates')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan certificates')
    } finally {
      setScanning(false)
      setLoading(false)
    }
  }, [apiCall])

  useEffect(() => {
    scanCertificates()
  }, [scanCertificates])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.crt')) {
      setError('Certificate file must have .crt extension')
      return
    }

    setUploading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const data = await apiCall<UploadResponse>('certificates/upload', {
        method: 'POST',
        body: formData,
      })

      if (data.success) {
        setSuccessMessage(`Certificate '${data.filename}' uploaded successfully`)
        await scanCertificates()
      } else {
        setError(data.message || 'Failed to upload certificate')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload certificate')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSelectCert = (filename: string, checked: boolean) => {
    setSelectedCerts(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(filename)
      } else {
        newSet.delete(filename)
      }
      return newSet
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const notInSystem = certificates
        .filter(c => !c.exists_in_system)
        .map(c => c.filename)
      setSelectedCerts(new Set(notInSystem))
    } else {
      setSelectedCerts(new Set())
    }
  }

  const handleAddToSystem = async () => {
    if (selectedCerts.size === 0) {
      setError('Please select at least one certificate')
      return
    }

    setAdding(true)
    setError(null)
    setSuccessMessage(null)

    const results: { filename: string; success: boolean; output: string }[] = []

    for (const filename of selectedCerts) {
      try {
        const data = await apiCall<AddCertificateResponse>('certificates/add-to-system', {
          method: 'POST',
          body: { filename },
        })

        results.push({
          filename,
          success: data.success,
          output: data.command_output || data.message || (data.error ? `Error: ${data.error}` : ''),
        })
      } catch (err) {
        results.push({
          filename,
          success: false,
          output: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const allSuccess = results.every(r => r.success)
    const output = results.map(r =>
      `=== ${r.filename} ===\n${r.success ? '✓ Success' : '✗ Failed'}\n${r.output}`
    ).join('\n\n')

    setModalTitle(allSuccess ? 'Certificates Added Successfully' : 'Certificate Operation Results')
    setModalOutput(output)
    setModalSuccess(allSuccess)
    setModalOpen(true)

    await scanCertificates()
    setSelectedCerts(new Set())
    setAdding(false)
  }

  const handleDeleteCert = useCallback(async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await apiCall(`certificates/${encodeURIComponent(deleteTarget)}`, { method: 'DELETE' })
      toast({ title: 'Deleted', description: `Certificate '${deleteTarget}' deleted` })
      setCertificates(prev => prev.filter(c => c.filename !== deleteTarget))
      setSelectedCerts(prev => {
        const newSet = new Set(prev)
        newSet.delete(deleteTarget)
        return newSet
      })
      setDeleteTarget(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete certificate'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, apiCall, toast])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const certsNotInSystem = certificates.filter(c => !c.exists_in_system)
  const allSelectableSelected = certsNotInSystem.length > 0 &&
    certsNotInSystem.every(c => selectedCerts.has(c.filename))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading certificates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-500 text-white shadow-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Certificate Manager</h1>
              <p className="text-gray-600 mt-1">
                Upload and manage CA certificates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => scanCertificates()}
              variant="outline"
              disabled={scanning}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              Scan
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".crt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={handleUploadClick}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload Certificate'}
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert className="border-red-500 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertTitle className="text-red-700">Error</AlertTitle>
            <AlertDescription className="text-red-600">{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">Success</AlertTitle>
            <AlertDescription className="text-green-600">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Directory Info */}
        {certsDirectory && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <FolderSearch className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-blue-700">
                  Scanning directory: <code className="bg-blue-100 px-2 py-0.5 rounded font-mono text-xs">{certsDirectory}</code>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certificates Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Certificates
                </CardTitle>
                <CardDescription>
                  {certificates.length} certificate(s) found
                </CardDescription>
              </div>
              {selectedCerts.size > 0 && (
                <Button
                  onClick={handleAddToSystem}
                  disabled={adding}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {adding ? 'Adding...' : `Add ${selectedCerts.size} to System CA`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {certificates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No certificates found</p>
                <p className="text-sm mt-2">
                  Upload a .crt file or add certificates to the config/oidc directory
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelectableSelected}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                        disabled={certsNotInSystem.length === 0}
                      />
                    </TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((cert) => (
                    <TableRow key={cert.filename}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCerts.has(cert.filename)}
                          onCheckedChange={(checked) =>
                            handleSelectCert(cert.filename, checked as boolean)
                          }
                          disabled={cert.exists_in_system}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {cert.filename}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatFileSize(cert.size)}
                      </TableCell>
                      <TableCell>
                        {cert.exists_in_system ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            In System CA
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                            <Info className="w-3 h-3 mr-1" />
                            Not in System
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(cert.filename)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-2">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Certificates must be in PEM format with .crt extension</li>
                  <li>Adding to system CA requires root/sudo privileges on the server</li>
                  <li>The operation copies certificates to <code className="bg-amber-100 px-1 rounded">/usr/local/share/ca-certificates/</code></li>
                  <li>The <code className="bg-amber-100 px-1 rounded">update-ca-certificates</code> command is executed to update the trust store</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Command Output Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {modalTitle}
            </DialogTitle>
            <DialogDescription>
              Command execution output
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-auto max-h-96 whitespace-pre-wrap">
            {modalOutput}
          </pre>
          <DialogFooter>
            <Button onClick={() => setModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Certificate</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleteTarget}</strong> from the server? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCert} disabled={deleting} className="gap-2">
              {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
