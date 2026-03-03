'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Clock, KeyRound } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CertificateInfo } from '../types'

interface CertificateCardProps {
  cert: CertificateInfo
  isSelected: boolean
  onToggleSelect: (index: number) => void
}

function getDaysUntilExpiry(notAfter: string): number {
  const expiry = new Date(notAfter)
  const now = new Date()
  return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function extractCN(dn: string): string {
  const match = dn.match(/CN=([^,]+)/)
  return match?.[1]?.trim() ?? dn
}

export function CertificateCard({ cert, isSelected, onToggleSelect }: CertificateCardProps) {
  const [expanded, setExpanded] = useState(false)
  const daysLeft = getDaysUntilExpiry(cert.not_after)

  const validityBadge = cert.is_expired ? (
    <Badge variant="destructive" className="text-xs flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />
      Expired
    </Badge>
  ) : daysLeft <= 30 ? (
    <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300 flex items-center gap-1">
      <Clock className="h-3 w-3" />
      {daysLeft}d left
    </Badge>
  ) : (
    <Badge className="text-xs bg-green-100 text-green-700 border-green-300 flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      Valid
    </Badge>
  )

  return (
    <div
      className={cn(
        'border rounded-lg p-3 transition-colors',
        isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(cert.index)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 truncate">
              {extractCN(cert.subject)}
            </span>
            {validityBadge}
            {cert.has_private_key && (
              <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-300 flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Includes private key
              </Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Issuer: {extractCN(cert.issuer)}
          </div>
          <div className="text-xs text-slate-500">
            {new Date(cert.not_before).toLocaleDateString()} →{' '}
            {new Date(cert.not_after).toLocaleDateString()}
          </div>
          {cert.san.length > 0 && (
            <div className="text-xs text-slate-500 mt-1">
              SAN: {cert.san.slice(0, 3).join(', ')}
              {cert.san.length > 3 && ` +${cert.san.length - 3} more`}
            </div>
          )}
          <div className="text-xs text-slate-400 mt-1 font-mono truncate">
            SHA256: {cert.fingerprint_sha256.slice(0, 29)}…
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? 'Hide' : 'View'} raw output
      </button>

      {expanded && (
        <pre className="mt-2 text-xs bg-slate-900 text-green-400 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
          {cert.raw_text || '(no raw output available)'}
        </pre>
      )}
    </div>
  )
}
