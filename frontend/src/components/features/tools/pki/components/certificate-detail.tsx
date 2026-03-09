'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CertificateResponse } from '../types'

interface Props {
  cert: CertificateResponse
}

export function CertificateDetail({ cert }: Props) {
  const [showPem, setShowPem] = useState(false)

  const formatDate = (d: string) => new Date(d).toLocaleDateString()

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <div><span className="text-muted-foreground">Common Name</span><p className="font-medium">{cert.common_name}</p></div>
        <div><span className="text-muted-foreground">Type</span><p><Badge variant="outline" className="capitalize">{cert.cert_type}</Badge></p></div>
        {cert.organization && <div><span className="text-muted-foreground">Organization</span><p>{cert.organization}</p></div>}
        {cert.country && <div><span className="text-muted-foreground">Country</span><p>{cert.country}</p></div>}
        {cert.state && <div><span className="text-muted-foreground">State</span><p>{cert.state}</p></div>}
        {cert.city && <div><span className="text-muted-foreground">City</span><p>{cert.city}</p></div>}
        {cert.org_unit && <div><span className="text-muted-foreground">Org Unit</span><p>{cert.org_unit}</p></div>}
        {cert.email && <div><span className="text-muted-foreground">Email</span><p>{cert.email}</p></div>}
        <div><span className="text-muted-foreground">Serial</span><p className="font-mono text-xs truncate">{cert.serial_number}</p></div>
        <div><span className="text-muted-foreground">Key Size</span><p>{cert.key_size} bit</p></div>
        <div><span className="text-muted-foreground">Valid From</span><p>{formatDate(cert.not_before)}</p></div>
        <div><span className="text-muted-foreground">Valid Until</span><p>{formatDate(cert.not_after)}</p></div>
        {cert.san_dns && cert.san_dns.length > 0 && (
          <div className="col-span-2">
            <span className="text-muted-foreground">DNS SANs</span>
            <p>{cert.san_dns.join(', ')}</p>
          </div>
        )}
        {cert.san_ip && cert.san_ip.length > 0 && (
          <div className="col-span-2">
            <span className="text-muted-foreground">IP SANs</span>
            <p>{cert.san_ip.join(', ')}</p>
          </div>
        )}
        {cert.is_revoked && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Revocation</span>
            <p className="text-destructive">
              Revoked on {cert.revoked_at ? formatDate(cert.revoked_at) : '—'}
              {cert.revocation_reason && ` (${cert.revocation_reason})`}
            </p>
          </div>
        )}
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="p-0 h-auto text-muted-foreground hover:text-foreground"
          onClick={() => setShowPem(!showPem)}
        >
          {showPem ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {showPem ? 'Hide' : 'Show'} Certificate PEM
        </Button>
        {showPem && (
          <textarea
            readOnly
            value={cert.cert_pem}
            className="mt-2 w-full h-40 font-mono text-xs p-2 bg-muted rounded border resize-none"
          />
        )}
      </div>
    </div>
  )
}
