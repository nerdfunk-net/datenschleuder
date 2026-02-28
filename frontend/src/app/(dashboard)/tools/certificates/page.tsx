'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ShieldCheck,
  ChevronLeft,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FolderOpen,
  FileLock2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface FileStatus {
  filename: string
  exists: boolean
}

interface CertificateInfo {
  name: string
  password_set: boolean
  files: {
    ca_cert_file: FileStatus
    cert_file: FileStatus
    key_file: FileStatus
  }
}

interface CertificatesResponse {
  certificates: CertificateInfo[]
  certs_dir: string
  config_file: string
  config_exists: boolean
}

interface AddCertForm {
  name: string
  ca_cert_content: string
  cert_content: string
  key_content: string
  password: string
}

const EMPTY_FORM: AddCertForm = {
  name: '',
  ca_cert_content: '',
  cert_content: '',
  key_content: '',
  password: '',
}

function FileStatusBadge({ file }: { file: FileStatus }) {
  if (!file.filename) {
    return <Badge variant="secondary" className="text-xs gap-1">Not configured</Badge>
  }
  return file.exists ? (
    <Badge variant="default" className="text-xs gap-1">
      <CheckCircle2 className="w-3 h-3" />
      {file.filename}
    </Badge>
  ) : (
    <Badge variant="destructive" className="text-xs gap-1">
      <XCircle className="w-3 h-3" />
      {file.filename} — missing
    </Badge>
  )
}

export default function CertificatesToolPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { apiCall } = useApi()
  const { toast } = useToast()

  const [data, setData] = useState<CertificatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState<AddCertForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Redirect non-admin users
  useEffect(() => {
    if (isAuthenticated && user && !user.roles.includes('admin')) {
      router.replace('/')
    }
  }, [isAuthenticated, user, router])

  const fetchCertificates = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiCall<CertificatesResponse>('tools/certificates', { method: 'GET' })
      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load certificates'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [apiCall, toast])

  useEffect(() => {
    if (isAuthenticated && user?.roles.includes('admin')) {
      fetchCertificates()
    }
  }, [isAuthenticated, user, fetchCertificates])

  const handleAdd = useCallback(async () => {
    if (!addForm.name.trim()) {
      toast({ title: 'Validation', description: 'Certificate name is required.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiCall('tools/certificates', {
        method: 'POST',
        body: JSON.stringify({
          name: addForm.name.trim(),
          ca_cert_content: addForm.ca_cert_content || null,
          cert_content: addForm.cert_content || null,
          key_content: addForm.key_content || null,
          password: addForm.password,
        }),
      })
      toast({ title: 'Success', description: `Certificate '${addForm.name}' added.` })
      setShowAddDialog(false)
      setAddForm(EMPTY_FORM)
      await fetchCertificates()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add certificate'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }, [addForm, apiCall, toast, fetchCertificates])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiCall(`tools/certificates/${encodeURIComponent(deleteTarget)}?delete_files=${deleteFiles}`, {
        method: 'DELETE',
      })
      toast({
        title: 'Deleted',
        description: `Certificate '${deleteTarget}' removed${deleteFiles ? ' (files deleted)' : ''}.`,
      })
      setDeleteTarget(null)
      setDeleteFiles(false)
      await fetchCertificates()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete certificate'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleteFiles, apiCall, toast, fetchCertificates])

  if (!isAuthenticated || !user || !user.roles.includes('admin')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <Button variant="outline" size="sm" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Tools
              </Button>
            </Link>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-500 text-white shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Certificate Manager</h1>
              <p className="text-gray-600 mt-1">
                Manage client certificates used for NiFi and other service authentication
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchCertificates} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Certificate
            </Button>
          </div>
        </div>

        {/* Config path info */}
        {data && (
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <FolderOpen className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div>
                    <span className="font-medium">Certs directory: </span>
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{data.certs_dir}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Config file: </span>
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{data.config_file}</code>
                    {data.config_exists ? (
                      <Badge variant="default" className="text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Found
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Not found — will be created on first add</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && !data && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3 text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading certificates...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data && data.certificates.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No certificates are configured. Click <strong>Add Certificate</strong> to register one.
            </AlertDescription>
          </Alert>
        )}

        {/* Certificate list */}
        {data?.certificates.map((cert) => {
          const hasIssues =
            !cert.files.ca_cert_file.exists ||
            !cert.files.cert_file.exists ||
            !cert.files.key_file.exists

          return (
            <Card key={cert.name} className={hasIssues ? 'border-amber-300' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileLock2 className={`w-5 h-5 ${hasIssues ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <div>
                      <CardTitle className="text-lg">{cert.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        {cert.password_set ? (
                          <span className="text-xs text-gray-500">Password: <span className="text-gray-700 font-medium">set</span></span>
                        ) : (
                          <span className="text-xs text-gray-400">No password</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                    onClick={() => { setDeleteTarget(cert.name); setDeleteFiles(false) }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-gray-500">CA Certificate</span>
                    <div><FileStatusBadge file={cert.files.ca_cert_file} /></div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-gray-500">Client Certificate</span>
                    <div><FileStatusBadge file={cert.files.cert_file} /></div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-gray-500">Private Key</span>
                    <div><FileStatusBadge file={cert.files.key_file} /></div>
                  </div>
                </div>
                {hasIssues && (
                  <Alert className="mt-3 border-amber-400 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-xs">
                      One or more PEM files are missing from the filesystem. Ensure the files exist
                      in the certs directory.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* Info box */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Security Notice</p>
                <p>
                  Private key content is written to the server filesystem and stored in plaintext.
                  Ensure the server is secured appropriately and restrict access to the{' '}
                  <code className="bg-amber-100 px-1 rounded">certs/</code> directory.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Certificate Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Certificate</DialogTitle>
            <DialogDescription>
              Paste PEM-encoded certificate content. All fields except the name are optional —
              leave blank to configure the files manually on the server filesystem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cert-name">Certificate Name <span className="text-red-500">*</span></Label>
              <Input
                id="cert-name"
                placeholder="My NiFi Certificate"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
              <p className="text-xs text-gray-500">
                Used as the display name and to generate filenames.
              </p>
            </div>

            <Separator />

            <div className="space-y-1">
              <Label htmlFor="ca-cert">CA Certificate (PEM)</Label>
              <Textarea
                id="ca-cert"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={addForm.ca_cert_content}
                onChange={(e) => setAddForm((f) => ({ ...f, ca_cert_content: e.target.value }))}
                className="font-mono text-xs h-28 resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="client-cert">Client Certificate (PEM)</Label>
              <Textarea
                id="client-cert"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={addForm.cert_content}
                onChange={(e) => setAddForm((f) => ({ ...f, cert_content: e.target.value }))}
                className="font-mono text-xs h-28 resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="client-key">Private Key (PEM)</Label>
              <Textarea
                id="client-key"
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                value={addForm.key_content}
                onChange={(e) => setAddForm((f) => ({ ...f, key_content: e.target.value }))}
                className="font-mono text-xs h-28 resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cert-password">Password (if key is encrypted)</Label>
              <Input
                id="cert-password"
                type="password"
                placeholder="Leave blank if not encrypted"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setAddForm(EMPTY_FORM) }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting} className="gap-2">
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteFiles(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Certificate</DialogTitle>
            <DialogDescription>
              Remove <strong>{deleteTarget}</strong> from the configuration?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <input
              type="checkbox"
              id="delete-files"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="delete-files" className="text-sm text-red-800 cursor-pointer">
              Also delete associated PEM files from disk
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteFiles(false) }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
