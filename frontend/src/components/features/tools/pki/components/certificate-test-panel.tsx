'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { useCertificatesQuery } from '../hooks/use-pki-query'
import { usePKIMutations } from '../hooks/use-pki-mutations'
import type { DiagnosticStep, TestNifiResponse } from '../types'

const EMPTY_STEPS: DiagnosticStep[] = []

function StepIcon({ status }: { status: DiagnosticStep['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
  if (status === 'error') return <XCircle className="w-5 h-5 text-red-500 shrink-0" />
  if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
  return <MinusCircle className="w-5 h-5 text-muted-foreground shrink-0" />
}

function stepBorderColor(status: DiagnosticStep['status']): string {
  if (status === 'success') return 'border-l-green-500'
  if (status === 'error') return 'border-l-red-500'
  if (status === 'warning') return 'border-l-yellow-500'
  return 'border-l-muted'
}

function DetailsRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null
  const display = Array.isArray(value)
    ? value.length === 0
      ? '—'
      : value.join(', ')
    : typeof value === 'boolean'
      ? value ? 'Yes' : 'No'
      : String(value)
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground font-medium min-w-[140px] shrink-0">{label}</span>
      <span className="font-mono break-all">{display}</span>
    </div>
  )
}

const DETAIL_LABELS: Record<string, string> = {
  subject: 'Subject',
  san_dns: 'SAN DNS',
  san_ip: 'SAN IP',
  not_before: 'Valid From',
  not_after: 'Valid Until',
  is_expired: 'Expired',
  days_remaining: 'Days Remaining',
  is_revoked: 'Revoked',
  has_client_auth: 'Client Auth EKU',
  has_server_auth: 'Server Auth EKU',
  cert_type: 'Cert Type',
  ca_subject: 'CA Subject',
  ca_not_before: 'CA Valid From',
  ca_not_after: 'CA Valid Until',
  is_ca_expired: 'CA Expired',
  issuer_match: 'Issuer Match',
  key_algorithm: 'Key Algorithm',
  key_size_bits: 'Key Size (bits)',
  verify_ssl: 'Verify SSL',
  check_hostname: 'Check Hostname',
  loaded_client_cert: 'Client Cert Loaded',
  loaded_ca_cert: 'CA Cert Loaded',
  hostname: 'Hostname',
  port: 'Port',
  scheme: 'Scheme',
  resolved_ips: 'Resolved IPs',
  nifi_api_url: 'NiFi API URL',
  host: 'Host',
  latency_ms: 'Latency (ms)',
  protocol: 'TLS Protocol',
  cipher_name: 'Cipher',
  cipher_bits: 'Cipher Bits',
  server_cert_subject: 'Server Cert Subject',
  server_cert_issuer: 'Server Cert Issuer',
  server_cert_not_before: 'Server Cert Valid From',
  server_cert_not_after: 'Server Cert Expires',
  server_cert_san_dns: 'Server SAN DNS',
  server_cert_san_ip: 'Server SAN IP',
  ssl_error: 'SSL Error',
  url: 'API URL',
  http_status: 'HTTP Status',
  nifi_version: 'NiFi Version',
  error: 'Error Detail',
}

function DiagnosticStepRow({ step }: { step: DiagnosticStep }) {
  const [expanded, setExpanded] = useState(
    step.status === 'error' || 'server_cert_subject' in step.details
  )
  const hasDetails = Object.keys(step.details).length > 0

  return (
    <div className={`border-l-4 ${stepBorderColor(step.status)} pl-4 py-3 space-y-2`}>
      <div className="flex items-start gap-3">
        <StepIcon status={step.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {step.step}. {step.name}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 break-words">{step.message}</p>
        </div>
        {hasDetails && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Details
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="ml-8 space-y-1 bg-muted/40 rounded-md p-3">
          {Object.entries(step.details).map(([k, v]) => (
            <DetailsRow key={k} label={DETAIL_LABELS[k] ?? k} value={v} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultsSummary({ result }: { result: TestNifiResponse }) {
  const { all_passed, error_count, warning_count, nifi_version } = result.summary
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Badge variant={all_passed ? 'default' : 'destructive'} className="text-sm px-3 py-1">
        {all_passed ? 'All checks passed' : `${error_count} error${error_count !== 1 ? 's' : ''}`}
      </Badge>
      {warning_count > 0 && (
        <Badge variant="secondary">
          {warning_count} warning{warning_count !== 1 ? 's' : ''}
        </Badge>
      )}
      {nifi_version && (
        <span className="text-sm text-muted-foreground">NiFi version: {nifi_version}</span>
      )}
    </div>
  )
}

export function CertificateTestPanel() {
  const { data: certsData, isLoading: certsLoading } = useCertificatesQuery()
  const { testNifi } = usePKIMutations()

  const [selectedCertId, setSelectedCertId] = useState<string>('')
  const [nifiUrl, setNifiUrl] = useState('')
  const [verifySsl, setVerifySsl] = useState(true)
  const [checkHostname, setCheckHostname] = useState(true)
  const [result, setResult] = useState<TestNifiResponse | null>(null)

  const certs = useMemo(() => certsData?.certificates ?? [], [certsData])

  const handleRun = useCallback(async () => {
    if (!selectedCertId || !nifiUrl.trim()) return
    setResult(null)
    const data = await testNifi.mutateAsync({
      certId: Number(selectedCertId),
      request: { nifi_url: nifiUrl.trim(), verify_ssl: verifySsl, check_hostname: checkHostname },
    })
    setResult(data)
  }, [selectedCertId, nifiUrl, verifySsl, checkHostname, testNifi])

  const canRun = selectedCertId && nifiUrl.trim() && !testNifi.isPending

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Certificate Connection Test
          </CardTitle>
          <CardDescription>
            Select a PKI certificate and enter a NiFi URL to run a step-by-step connectivity
            diagnostic. Each step reports what worked, what failed, and detailed context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cert-select">Certificate</Label>
              <Select
                value={selectedCertId}
                onValueChange={setSelectedCertId}
                disabled={certsLoading}
              >
                <SelectTrigger id="cert-select">
                  <SelectValue placeholder={certsLoading ? 'Loading…' : 'Select a certificate'} />
                </SelectTrigger>
                <SelectContent>
                  {certs.map((cert) => (
                    <SelectItem key={cert.id} value={String(cert.id)}>
                      <span className="flex items-center gap-2">
                        {cert.common_name}
                        <span className="text-xs text-muted-foreground">({cert.cert_type})</span>
                        {cert.is_revoked && (
                          <span className="text-xs text-red-500 font-medium">revoked</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nifi-url">NiFi URL</Label>
              <Input
                id="nifi-url"
                type="url"
                placeholder="https://nifi.example.com:8443"
                value={nifiUrl}
                onChange={(e) => setNifiUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={verifySsl}
                onChange={(e) => {
                  setVerifySsl(e.target.checked)
                  if (!e.target.checked) setCheckHostname(false)
                }}
              />
              <span className="text-sm">Verify SSL</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={checkHostname}
                disabled={!verifySsl}
                onChange={(e) => setCheckHostname(e.target.checked)}
              />
              <span className="text-sm text-muted-foreground">Check Hostname</span>
            </label>
          </div>

          <Button onClick={handleRun} disabled={!canRun} className="w-full sm:w-auto">
            {testNifi.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running diagnostic…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">Diagnostic Results</CardTitle>
              <ResultsSummary result={result} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(result.steps ?? EMPTY_STEPS).map((step) => (
              <DiagnosticStepRow key={step.step} step={step} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
