'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Shield, RefreshCw } from 'lucide-react'
import { useOidcDebugInfo } from './hooks/use-oidc-debug-info'
import { useDebugLogging } from './hooks/use-debug-logging'
import { useOidcTestParameters } from './hooks/use-oidc-test-parameters'
import { StatusOverview } from './components/status-overview'
import { ProviderList } from './components/provider-list'
import { ConfigurationDetails } from './components/configuration-details'
import { GlobalConfigSection } from './components/global-config-section'
import { DebugLogsSection } from './components/debug-logs-section'

export default function OIDCTestPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)

  const { data: debugInfo, isLoading, refetch } = useOidcDebugInfo()
  const { logs, addLog } = useDebugLogging()
  const testParams = useOidcTestParameters()

  // Auto-select first provider when data loads
  useEffect(() => {
    if (debugInfo?.providers.length && !selectedProvider) {
      const first = debugInfo.providers[0]
      if (first) setSelectedProvider(first.provider_id)
    }
  }, [debugInfo, selectedProvider])

  const handleRefresh = useCallback(() => {
    addLog('info', 'Refreshing OIDC configuration...')
    refetch()
  }, [addLog, refetch])

  const handleTestLogin = useCallback(
    async (providerId: string, overrides?: Record<string, unknown>) => {
      setTestingProvider(providerId)
      addLog('info', `Initiating test login for provider: ${providerId}`)

      if (overrides && Object.values(overrides).some((v) => v)) {
        addLog('info', 'Using custom test parameters', overrides)
      }

      try {
        const endpoint = overrides
          ? `/api/proxy/auth/oidc/${providerId}/test-login`
          : `/api/proxy/auth/oidc/${providerId}/login`

        const options = overrides
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(overrides),
            }
          : { method: 'GET' }

        const response = await fetch(endpoint, options)

        if (!response.ok) {
          throw new Error(`Failed to initiate OIDC login: ${response.status}`)
        }

        const data = await response.json()

        addLog('success', 'Authorization URL generated', {
          provider_id: data.provider_id,
          test_mode: data.test_mode || false,
          state: data.state?.substring(0, 10) + '...',
        })

        if (data.test_mode && data.overrides) {
          addLog('info', 'Test overrides applied', data.overrides)
        }

        if (data.authorization_url) {
          addLog('info', 'Redirecting to OIDC provider...')

          if (data.state) sessionStorage.setItem('oidc_state', data.state)
          if (data.provider_id) sessionStorage.setItem('oidc_provider_id', data.provider_id)

          window.location.href = data.authorization_url
        }
      } catch (err) {
        addLog('error', 'Test login failed', { error: String(err) })
        setTestingProvider(null)
      }
    },
    [addLog],
  )

  const selectedProviderInfo = debugInfo?.providers.find(
    (p) => p.provider_id === selectedProvider,
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading OIDC configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-500" />
              OIDC Testing Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Debug and test OpenID Connect authentication flows
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <StatusOverview debugInfo={debugInfo} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ProviderList
            providers={debugInfo?.providers ?? []}
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProvider}
          />

          {selectedProviderInfo ? (
            <ConfigurationDetails
              provider={selectedProviderInfo}
              testParams={testParams}
              testingProvider={testingProvider}
              onTestLogin={handleTestLogin}
            />
          ) : (
            <div className="lg:col-span-2 flex items-center justify-center text-gray-500">
              Select a provider to view details
            </div>
          )}
        </div>

        <GlobalConfigSection globalConfig={debugInfo?.global_config} />

        <DebugLogsSection logs={logs} />
      </div>
    </div>
  )
}
