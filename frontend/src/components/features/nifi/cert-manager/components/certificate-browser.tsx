'use client'

import { Shield, Loader2 } from 'lucide-react'
import { useCertificatesQuery } from '../hooks/use-certificates-query'
import { CertificateCard } from './certificate-card'

interface CertificateBrowserProps {
  instanceId: number | null
  filePath: string | null
  filePassword: string
  selectedIndices: number[]
  onToggleCert: (index: number) => void
}

export function CertificateBrowser({
  instanceId,
  filePath,
  filePassword,
  selectedIndices,
  onToggleCert,
}: CertificateBrowserProps) {
  const { data, isLoading, isError, error } = useCertificatesQuery({
    instanceId,
    filePath,
    password: filePassword || undefined,
  })

  const certs = data?.certificates ?? []

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Shield className="h-4 w-4" />
          <span className="text-sm font-medium">Certificates</span>
        </div>
        {certs.length > 0 && (
          <span className="text-xs text-blue-100">
            {selectedIndices.length} / {certs.length} selected
          </span>
        )}
      </div>
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        {!filePath && (
          <p className="text-sm text-slate-400 text-center py-8">
            Select a certificate file to inspect its contents.
          </p>
        )}

        {filePath && isLoading && (
          <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Parsing certificates...</span>
          </div>
        )}

        {filePath && isError && (
          <div className="text-center py-8">
            <p className="text-sm text-red-500">
              Failed to parse certificates.
            </p>
            {error instanceof Error && (
              <p className="text-xs text-slate-400 mt-1">{error.message}</p>
            )}
            {data?.file_type === 'p12' && (
              <p className="text-xs text-slate-500 mt-2">
                If this is an encrypted P12 file, enter the password in the file browser.
              </p>
            )}
          </div>
        )}

        {!isLoading && !isError && certs.length === 0 && filePath && (
          <p className="text-sm text-slate-500 text-center py-8">
            No certificates found in this file.
          </p>
        )}

        {certs.length > 0 && (
          <div className="space-y-3">
            {certs.map((cert) => (
              <CertificateCard
                key={cert.index}
                cert={cert}
                isSelected={selectedIndices.includes(cert.index)}
                onToggleSelect={onToggleCert}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
