'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useCertificatesQuery } from '../hooks/use-pki-query'
import { useCAQuery } from '../hooks/use-pki-query'
import { usePKIMutations } from '../hooks/use-pki-mutations'
import { CreateCertificateDialog } from '../dialogs/create-certificate-dialog'
import { RevokeCertificateDialog } from '../dialogs/revoke-certificate-dialog'
import { ExportPKCS12Dialog } from '../dialogs/export-pkcs12-dialog'
import { ExportKeyDialog } from '../dialogs/export-key-dialog'
import { CertificateDetail } from './certificate-detail'
import type { CertificateResponse, RevocationReason } from '../types'

export function CertificateTable() {
  const { data: caData } = useCAQuery()
  const { data, isLoading } = useCertificatesQuery()
  const mutations = usePKIMutations()

  const [createOpen, setCreateOpen] = useState(false)
  const [detailCert, setDetailCert] = useState<CertificateResponse | null>(null)
  const [revokeCert, setRevokeCert] = useState<CertificateResponse | null>(null)
  const [pkcs12CertId, setPkcs12CertId] = useState<number | null>(null)
  const [keyCertId, setKeyCertId] = useState<number | null>(null)

  const certificates = data?.certificates ?? []
  const hasCA = !!caData

  const certStatus = (cert: CertificateResponse) => {
    if (cert.is_revoked) return { label: 'Revoked', variant: 'destructive' as const }
    if (new Date(cert.not_after) < new Date()) return { label: 'Expired', variant: 'secondary' as const }
    return { label: 'Active', variant: 'default' as const }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString()

  const handleRevoke = (id: number, reason: RevocationReason) => {
    mutations.revokeCertificate.mutate({ id, reason }, {
      onSuccess: () => setRevokeCert(null),
    })
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading certificates...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{certificates.length} certificate(s)</p>
        <Button
          size="sm"
          disabled={!hasCA}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Issue Certificate
        </Button>
      </div>

      {certificates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {hasCA ? 'No certificates issued yet.' : 'Create a CA first to issue certificates.'}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Common Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((cert) => {
                const status = certStatus(cert)
                return (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium">{cert.common_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{cert.cert_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {cert.serial_number.slice(0, 12)}...
                    </TableCell>
                    <TableCell>{formatDate(cert.not_after)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailCert(cert)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => mutations.exportCert.mutate(cert.id)}
                            disabled={mutations.exportCert.isPending}
                          >
                            Export Certificate PEM
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setKeyCertId(cert.id)}>
                            Export Private Key
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => mutations.exportPEM.mutate(cert.id)}
                            disabled={mutations.exportPEM.isPending}
                          >
                            Export PEM Bundle (cert + CA)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPkcs12CertId(cert.id)}>
                            Export PKCS#12
                          </DropdownMenuItem>
                          {!cert.is_revoked && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setRevokeCert(cert)}
                              >
                                Revoke
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateCertificateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => mutations.createCertificate.mutate(data, { onSuccess: () => setCreateOpen(false) })}
        isPending={mutations.createCertificate.isPending}
      />

      <Dialog open={!!detailCert} onOpenChange={(v) => !v && setDetailCert(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Certificate Details</DialogTitle>
          </DialogHeader>
          {detailCert && <CertificateDetail cert={detailCert} />}
        </DialogContent>
      </Dialog>

      <RevokeCertificateDialog
        open={!!revokeCert}
        onOpenChange={(v) => !v && setRevokeCert(null)}
        cert={revokeCert}
        onSubmit={handleRevoke}
        isPending={mutations.revokeCertificate.isPending}
      />

      <ExportPKCS12Dialog
        open={pkcs12CertId !== null}
        onOpenChange={(v) => !v && setPkcs12CertId(null)}
        certId={pkcs12CertId}
        onSubmit={(id, password) =>
          mutations.exportPKCS12.mutate({ id, password }, { onSuccess: () => setPkcs12CertId(null) })
        }
        isPending={mutations.exportPKCS12.isPending}
      />

      <ExportKeyDialog
        open={keyCertId !== null}
        onOpenChange={(v) => !v && setKeyCertId(null)}
        certId={keyCertId}
        onSubmit={(id, passphrase) =>
          mutations.exportPrivateKey.mutate({ id, passphrase }, { onSuccess: () => setKeyCertId(null) })
        }
        isPending={mutations.exportPrivateKey.isPending}
      />
    </div>
  )
}
