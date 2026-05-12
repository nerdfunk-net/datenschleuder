'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { FileCheck, MoreHorizontal, Plus, Search } from 'lucide-react'
import { useCertificatesQuery, useCAQuery } from '../hooks/use-pki-query'
import { usePKIMutations } from '../hooks/use-pki-mutations'
import { CreateCertificateDialog } from '../dialogs/create-certificate-dialog'
import { RevokeCertificateDialog } from '../dialogs/revoke-certificate-dialog'
import { ExportPKCS12Dialog } from '../dialogs/export-pkcs12-dialog'
import { ExportKeyDialog } from '../dialogs/export-key-dialog'
import { CertificateDetail } from './certificate-detail'
import type { CertificateResponse, CertType, RevocationReason } from '../types'

type StatusFilter = 'all' | 'active' | 'expired' | 'revoked'

const EMPTY_CERTIFICATES: CertificateResponse[] = []

function getCertStatus(cert: CertificateResponse) {
  if (cert.is_revoked) return { label: 'Revoked', variant: 'destructive' as const, key: 'revoked' }
  if (new Date(cert.not_after) < new Date()) return { label: 'Expired', variant: 'secondary' as const, key: 'expired' }
  return { label: 'Active', variant: 'default' as const, key: 'active' }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString()
}

export function CertificateTable() {
  const { data: caData } = useCAQuery()
  const { data, isLoading } = useCertificatesQuery()
  const mutations = usePKIMutations()

  const [createOpen, setCreateOpen] = useState(false)
  const [detailCert, setDetailCert] = useState<CertificateResponse | null>(null)
  const [revokeCert, setRevokeCert] = useState<CertificateResponse | null>(null)
  const [pkcs12CertId, setPkcs12CertId] = useState<number | null>(null)
  const [keyCertId, setKeyCertId] = useState<number | null>(null)

  const [nameFilter, setNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<CertType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const certificates = data?.certificates ?? EMPTY_CERTIFICATES
  const hasCA = !!caData

  const filtered = useMemo(() => {
    return certificates.filter((cert) => {
      if (nameFilter && !cert.common_name.toLowerCase().includes(nameFilter.toLowerCase())) return false
      if (typeFilter !== 'all' && cert.cert_type !== typeFilter) return false
      if (statusFilter !== 'all' && getCertStatus(cert).key !== statusFilter) return false
      return true
    })
  }, [certificates, nameFilter, typeFilter, statusFilter])

  const handleRevoke = (id: number, reason: RevocationReason) => {
    mutations.revokeCertificate.mutate({ id, reason }, {
      onSuccess: () => setRevokeCert(null),
    })
  }

  return (
    <>
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FileCheck className="h-4 w-4" />
            <span className="text-sm font-medium">Certificates</span>
          </div>
          <div className="text-xs text-blue-100">
            {isLoading ? 'Loading...' : `${certificates.length} certificate(s)`}
          </div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  className="pl-8 h-8 w-48 text-sm"
                  placeholder="Filter name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CertType | 'all')}>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="server">Server</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="server+client">Server+Client</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={!hasCA}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Issue Certificate
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              <span className="ml-2 text-sm text-gray-600">Loading certificates...</span>
            </div>
          ) : certificates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">
                {hasCA ? 'No certificates issued yet.' : 'No Certificate Authority found.'}
              </p>
              <p className="text-sm mt-1">
                {hasCA ? 'Issue your first certificate using the button above.' : 'Create a CA first to issue certificates.'}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No certificates match the filters.</p>
              <p className="text-sm mt-1">Try adjusting your filter criteria.</p>
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
                  {filtered.map((cert) => {
                    const status = getCertStatus(cert)
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
        </div>
      </div>

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
    </>
  )
}
