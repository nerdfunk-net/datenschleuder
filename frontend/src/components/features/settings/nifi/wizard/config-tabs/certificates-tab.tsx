'use client'

import { useCallback, useState } from 'react'
import { ShieldCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useWizardStore } from '../wizard-store'
import { useApi } from '@/hooks/use-api'

interface ReadStoreResponse {
  subject: string
  issuer: string
  is_expired: boolean
  fingerprint_sha256: string
}

interface SubjectDialogState {
  instanceTempId: string
  instanceName: string
  gitRepoId: number
  keystorePassword: string
  truststorePassword: string
}

interface ReadResult {
  keystoreSubject?: string
  truststoreSubject?: string
  keystoreError?: string
  truststoreError?: string
}

export function CertificatesTab() {
  const instances = useWizardStore((s) => s.instances)
  const certificates = useWizardStore((s) => s.certificates)
  const adminCertSubject = useWizardStore((s) => s.adminCertSubject)
  const updateCertificate = useWizardStore((s) => s.updateCertificate)
  const setAdminCertSubject = useWizardStore((s) => s.setAdminCertSubject)

  const { apiCall } = useApi()

  const [dialog, setDialog] = useState<SubjectDialogState | null>(null)
  const [loading, setLoading] = useState(false)
  const [readResult, setReadResult] = useState<ReadResult | null>(null)

  const openDialog = useCallback(
    (instanceTempId: string) => {
      const inst = instances.find((i) => i.tempId === instanceTempId)
      if (!inst) return
      const cert = certificates.find((c) => c.instanceTempId === instanceTempId)
      setReadResult(null)
      setDialog({
        instanceTempId,
        instanceName: inst.name,
        gitRepoId: inst.git_config_repo_id,
        keystorePassword: cert?.keystorePassword ?? '',
        truststorePassword: cert?.truststorePassword ?? '',
      })
    },
    [instances, certificates]
  )

  const handleReadStores = useCallback(async () => {
    if (!dialog) return
    setLoading(true)
    setReadResult(null)

    let keystoreSubject: string | undefined
    let truststoreSubject: string | undefined
    let keystoreError: string | undefined
    let truststoreError: string | undefined

    try {
      const ks = await apiCall<ReadStoreResponse>('nifi/certificates/read-store', {
        method: 'POST',
        body: JSON.stringify({
          git_repo_id: dialog.gitRepoId,
          filename: 'keystore.p12',
          password: dialog.keystorePassword,
        }),
      })
      keystoreSubject = ks.subject
    } catch (e: unknown) {
      keystoreError = e instanceof Error ? e.message : 'Failed to read keystore'
    }

    try {
      const ts = await apiCall<ReadStoreResponse>('nifi/certificates/read-store', {
        method: 'POST',
        body: JSON.stringify({
          git_repo_id: dialog.gitRepoId,
          filename: 'truststore.p12',
          password: dialog.truststorePassword,
        }),
      })
      truststoreSubject = ts.subject
    } catch (e: unknown) {
      truststoreError = e instanceof Error ? e.message : 'Failed to read truststore'
    }

    // Persist passwords and update cert subject + file status flags
    updateCertificate(dialog.instanceTempId, {
      keystorePassword: dialog.keystorePassword,
      truststorePassword: dialog.truststorePassword,
      keystoreExists: keystoreSubject !== undefined,
      truststoreExists: truststoreSubject !== undefined,
      ...(keystoreSubject !== undefined ? { certSubject: keystoreSubject } : {}),
    })

    setReadResult({ keystoreSubject, truststoreSubject, keystoreError, truststoreError })
    setLoading(false)
  }, [dialog, apiCall, updateCertificate])

  const handleCloseDialog = useCallback(() => {
    setDialog(null)
    setReadResult(null)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-700">Certificate Subjects</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Enter the CN/DN subject for each instance&apos;s certificate. These are used to generate
          authorizers.xml. Use &quot;Get Subject&quot; to read the subject directly from the
          keystore.
        </p>
      </div>

      {/* Admin cert subject */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-2">
        <Label htmlFor="admin-cert">Admin / Client Certificate Subject *</Label>
        <Input
          id="admin-cert"
          placeholder="e.g. CN=admin, OU=NiFi"
          value={adminCertSubject}
          onChange={(e) => setAdminCertSubject(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The certificate subject of the admin user who will manage the cluster via browser.
        </p>
      </div>

      {/* Per-instance certs */}
      <div className="space-y-3">
        {certificates.map((cert) => {
          const inst = instances.find((i) => i.tempId === cert.instanceTempId)
          return (
            <div
              key={cert.instanceTempId}
              className="rounded-lg border border-slate-200 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-900">
                    {cert.instanceName || inst?.name}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDialog(cert.instanceTempId)}
                >
                  Get Subject
                </Button>
              </div>

              <div>
                <Label>Node Certificate Subject *</Label>
                <Input
                  placeholder="e.g. CN=nifi-node1, OU=NiFi"
                  value={cert.certSubject}
                  onChange={(e) =>
                    updateCertificate(cert.instanceTempId, { certSubject: e.target.value })
                  }
                />
              </div>

              {/* File status */}
              {cert.keystoreExists !== null && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    {cert.keystoreExists ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>keystore.p12</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {cert.truststoreExists ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>truststore.p12</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {certificates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No instances configured. Go back to Step 2 to add instances.
        </p>
      )}

      {/* Password dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Read Certificate Subjects</DialogTitle>
            <DialogDescription>
              Enter the passwords for the keystore and truststore of{' '}
              <strong>{dialog?.instanceName}</strong>. The subject will be read from{' '}
              <code>keystore.p12</code> and used to pre-fill the node certificate field.
              <br />
              <span className="text-amber-600 font-medium">
                Only PKCS12 (.p12) containers are supported.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="ks-password">Keystore Password</Label>
              <Input
                id="ks-password"
                type="password"
                placeholder="keystore password"
                value={dialog?.keystorePassword ?? ''}
                onChange={(e) =>
                  setDialog((d) => (d ? { ...d, keystorePassword: e.target.value } : d))
                }
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ts-password">Truststore Password</Label>
              <Input
                id="ts-password"
                type="password"
                placeholder="truststore password"
                value={dialog?.truststorePassword ?? ''}
                onChange={(e) =>
                  setDialog((d) => (d ? { ...d, truststorePassword: e.target.value } : d))
                }
                disabled={loading}
              />
            </div>

            {/* Results */}
            {readResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  {readResult.keystoreSubject ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-medium">keystore.p12: </span>
                    {readResult.keystoreSubject ? (
                      <span className="text-green-700 break-all">{readResult.keystoreSubject}</span>
                    ) : (
                      <span className="text-red-600">{readResult.keystoreError}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {readResult.truststoreSubject ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-medium">truststore.p12: </span>
                    {readResult.truststoreSubject ? (
                      <span className="text-green-700 break-all">
                        {readResult.truststoreSubject}
                      </span>
                    ) : (
                      <span className="text-red-600">{readResult.truststoreError}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseDialog} disabled={loading}>
              {readResult ? 'Close' : 'Cancel'}
            </Button>
            {!readResult && (
              <Button onClick={handleReadStores} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Read Certificates
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
