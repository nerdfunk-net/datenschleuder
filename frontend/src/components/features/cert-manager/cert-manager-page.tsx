'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { InstanceList } from './components/instance-list'
import { FileBrowser } from './components/file-browser'
import { CertificateBrowser } from './components/certificate-browser'
import { ActionsBar } from './components/actions-bar'
import { useNifiPasswordsQuery } from './hooks/use-nifi-passwords-query'
import type { NifiPasswordEntry } from './types'

const KEYSTORE_ORDER = ['nifi.security.keystorePasswd', 'nifi.security.keyPasswd', 'nifi.security.truststorePasswd']
const TRUSTSTORE_ORDER = ['nifi.security.truststorePasswd', 'nifi.security.keystorePasswd', 'nifi.security.keyPasswd']

export function CertManagerPage() {
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedCertIndices, setSelectedCertIndices] = useState<number[]>([])
  const [filePassword, setFilePassword] = useState<string>('')
  const [autoDetectedKey, setAutoDetectedKey] = useState<string | null>(null)

  const { apiCall } = useApi()
  const { data: nifiPasswordsData } = useNifiPasswordsQuery(selectedInstanceId, selectedFilePath)

  const handleSelectInstance = useCallback((id: number) => {
    setSelectedInstanceId(id)
    setSelectedFilePath(null)
    setSelectedCertIndices([])
    setFilePassword('')
    setAutoDetectedKey(null)
  }, [])

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFilePath(path)
    setSelectedCertIndices([])
    setFilePassword('')
    setAutoDetectedKey(null)
  }, [])

  const handleToggleCert = useCallback((index: number) => {
    setSelectedCertIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }, [])

  const handlePasswordChange = useCallback((password: string) => {
    setFilePassword(password)
    setAutoDetectedKey(null)
    setSelectedCertIndices([])
  }, [])

  const orderedPasswords = useMemo((): NifiPasswordEntry[] => {
    const passwords = nifiPasswordsData?.passwords
    if (!passwords?.length || !selectedFilePath) return []
    const lower = selectedFilePath.toLowerCase()
    const order = lower.includes('truststore') ? TRUSTSTORE_ORDER : KEYSTORE_ORDER
    return order
      .map((key) => passwords.find((p) => p.key === key))
      .filter((p): p is NifiPasswordEntry => p !== undefined)
  }, [nifiPasswordsData, selectedFilePath])

  useEffect(() => {
    if (!selectedFilePath?.toLowerCase().endsWith('.p12')) return
    if (!selectedInstanceId) return
    if (!orderedPasswords.length) return
    if (filePassword) return  // already set (auto or manual)

    let cancelled = false

    const tryPasswords = async () => {
      for (const entry of orderedPasswords) {
        if (cancelled) return
        try {
          await apiCall(
            `cert-manager/instances/${selectedInstanceId}/certificates?file_path=${encodeURIComponent(selectedFilePath)}&password=${encodeURIComponent(entry.value)}`,
          )
          if (!cancelled) {
            setFilePassword(entry.value)
            setAutoDetectedKey(entry.key)
          }
          return
        } catch {
          // try next password
        }
      }
    }

    tryPasswords()
    return () => { cancelled = true }
  }, [selectedFilePath, selectedInstanceId, orderedPasswords, filePassword, apiCall])

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Certificate Manager</h1>
            <p className="text-muted-foreground mt-2">
              Browse, inspect, convert, and manage TLS certificates for NiFi instances
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">
        {/* Left panel */}
        <div className="w-80 flex-shrink-0 space-y-4">
          <InstanceList
            selectedInstanceId={selectedInstanceId}
            onSelectInstance={handleSelectInstance}
          />
          <FileBrowser
            instanceId={selectedInstanceId}
            selectedFilePath={selectedFilePath}
            filePassword={filePassword}
            autoDetectedKey={autoDetectedKey}
            onSelectFile={handleSelectFile}
            onPasswordChange={handlePasswordChange}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 space-y-4">
          <CertificateBrowser
            instanceId={selectedInstanceId}
            filePath={selectedFilePath}
            filePassword={filePassword}
            selectedIndices={selectedCertIndices}
            onToggleCert={handleToggleCert}
          />
          <ActionsBar
            instanceId={selectedInstanceId}
            filePath={selectedFilePath}
            filePassword={filePassword}
            selectedIndices={selectedCertIndices}
          />
        </div>
      </div>
    </div>
  )
}
