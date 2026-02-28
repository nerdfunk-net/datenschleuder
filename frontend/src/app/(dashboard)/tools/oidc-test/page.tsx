'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Key,
  RefreshCw,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Play,
  Info,
  Copy,
  Check,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface OIDCProviderConfig {
  client_id: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  jwks_uri?: string
  issuer?: string
  ca_cert_path?: string
  ca_cert_exists?: boolean
  scopes: string[]
  response_type: string
}

interface OIDCProviderDebug {
  provider_id: string
  name: string
  enabled: boolean
  config: OIDCProviderConfig
  status: 'ok' | 'warning' | 'error'
  issues: string[]
}

interface OIDCDebugInfo {
  oidc_enabled: boolean
  allow_traditional_login: boolean
  providers: OIDCProviderDebug[]
  global_config: {
    default_role: string
    auto_create_users: boolean
    update_user_info: boolean
  }
  timestamp: string
}

interface TestParams {
  redirect_uri: string
  scopes: string
  response_type: string
  client_id: string
}

const DEFAULT_TEST_PARAMS: TestParams = {
  redirect_uri: '',
  scopes: '',
  response_type: '',
  client_id: '',
}

const STATUS_CONFIG = {
  ok: {
    variant: 'default' as const,
    icon: CheckCircle2,
    label: 'OK',
    className: 'text-green-600',
  },
  warning: {
    variant: 'secondary' as const,
    icon: AlertCircle,
    label: 'Warning',
    className: 'text-amber-600',
  },
  error: {
    variant: 'destructive' as const,
    icon: XCircle,
    label: 'Error',
    className: 'text-red-600',
  },
}

export default function OIDCTestPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { apiCall } = useApi()
  const { toast } = useToast()

  const [debugInfo, setDebugInfo] = useState<OIDCDebugInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  const [testParams, setTestParams] = useState<Record<string, TestParams>>({})
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Redirect non-admin users
  useEffect(() => {
    if (isAuthenticated && user && !user.roles.includes('admin')) {
      router.replace('/')
    }
  }, [isAuthenticated, user, router])

  const fetchDebugInfo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall<OIDCDebugInfo>('auth/oidc/debug', { method: 'GET' })
      setDebugInfo(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch OIDC debug info'
      setError(message)
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [apiCall, toast])

  useEffect(() => {
    if (isAuthenticated && user?.roles.includes('admin')) {
      fetchDebugInfo()
    }
  }, [isAuthenticated, user, fetchDebugInfo])

  const toggleProvider = useCallback((providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev)
      if (next.has(providerId)) {
        next.delete(providerId)
      } else {
        next.add(providerId)
      }
      return next
    })
  }, [])

  const getProviderTestParams = useCallback(
    (providerId: string): TestParams => {
      return testParams[providerId] ?? DEFAULT_TEST_PARAMS
    },
    [testParams]
  )

  const updateTestParam = useCallback(
    (providerId: string, field: keyof TestParams, value: string) => {
      setTestParams((prev) => ({
        ...prev,
        [providerId]: {
          ...DEFAULT_TEST_PARAMS,
          ...prev[providerId],
          [field]: value,
        },
      }))
    },
    []
  )

  const handleTestLogin = useCallback(
    async (providerId: string) => {
      setTestingProvider(providerId)
      try {
        const params = getProviderTestParams(providerId)
        const redirectUri =
          params.redirect_uri ||
          `${window.location.origin}/login/oidc-test-callback`

        const body: Record<string, string | string[]> = { redirect_uri: redirectUri }
        if (params.scopes) body.scopes = params.scopes.split(/\s+/).filter(Boolean)
        if (params.response_type) body.response_type = params.response_type
        if (params.client_id) body.client_id = params.client_id

        const result = await apiCall<{ authorization_url: string; state: string; provider_id: string }>(
          `auth/oidc/${providerId}/test-login`,
          { method: 'POST', body: JSON.stringify(body) }
        )

        // Store state and provider for callback verification
        sessionStorage.setItem('oidc_state', result.state)
        sessionStorage.setItem('oidc_provider_id', result.provider_id)

        // Redirect to the OIDC provider
        window.location.href = result.authorization_url
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initiate test login'
        toast({ title: 'Test Login Failed', description: message, variant: 'destructive' })
        setTestingProvider(null)
      }
    },
    [apiCall, getProviderTestParams, toast]
  )

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // ignore
    }
  }, [])

  const callbackUrl = useMemo(
    () =>
      typeof window !== 'undefined'
        ? `${window.location.origin}/login/oidc-test-callback`
        : '/login/oidc-test-callback',
    []
  )

  if (!isAuthenticated || !user || !user.roles.includes('admin')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <Button variant="outline" size="sm" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Tools
              </Button>
            </Link>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500 text-white shadow-lg">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">OIDC Test Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Debug and test OpenID Connect provider configurations
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={fetchDebugInfo}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Alert className="border-red-500 bg-red-50">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {loading && !debugInfo && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3 text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading OIDC configuration...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {debugInfo && (
          <>
            {/* Global Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Global Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">OIDC Enabled</div>
                    <div className="flex items-center gap-1">
                      {debugInfo.oidc_enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-semibold text-gray-800">
                        {debugInfo.oidc_enabled ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Traditional Login</div>
                    <div className="flex items-center gap-1">
                      {debugInfo.allow_traditional_login ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-semibold text-gray-800">
                        {debugInfo.allow_traditional_login ? 'Allowed' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Default Role</div>
                    <span className="font-semibold text-gray-800">
                      {debugInfo.global_config.default_role}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Auto-create Users</div>
                    <div className="flex items-center gap-1">
                      {debugInfo.global_config.auto_create_users ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-semibold text-gray-800">
                        {debugInfo.global_config.auto_create_users ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* No providers */}
            {debugInfo.providers.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No OIDC providers are configured or enabled.
                  Configure providers in <code>config/oidc_providers.yaml</code>.
                </AlertDescription>
              </Alert>
            )}

            {/* Providers */}
            {debugInfo.providers.map((provider) => {
              const isExpanded = expandedProviders.has(provider.provider_id)
              const params = getProviderTestParams(provider.provider_id)
              const statusCfg = STATUS_CONFIG[provider.status]
              const StatusIcon = statusCfg.icon

              return (
                <Card
                  key={provider.provider_id}
                  className={
                    provider.status === 'error'
                      ? 'border-red-300'
                      : provider.status === 'warning'
                        ? 'border-amber-300'
                        : ''
                  }
                >
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleProvider(provider.provider_id)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-1 ${statusCfg.className}`}>
                              <StatusIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{provider.name}</CardTitle>
                              <CardDescription className="font-mono text-xs">
                                {provider.provider_id}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-6">
                        {/* Issues */}
                        {provider.issues.length > 0 && (
                          <Alert className="border-amber-400 bg-amber-50">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                              <ul className="list-disc list-inside space-y-1">
                                {provider.issues.map((issue) => (
                                  <li key={issue}>{issue}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Config details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {[
                            { label: 'Client ID', value: provider.config.client_id },
                            { label: 'Issuer', value: provider.config.issuer },
                            { label: 'Authorization Endpoint', value: provider.config.authorization_endpoint },
                            { label: 'Token Endpoint', value: provider.config.token_endpoint },
                            { label: 'Userinfo Endpoint', value: provider.config.userinfo_endpoint },
                            { label: 'JWKS URI', value: provider.config.jwks_uri },
                          ].map(({ label, value }) =>
                            value ? (
                              <div key={label} className="space-y-1">
                                <span className="text-xs font-medium text-gray-500">{label}</span>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 flex-1 break-all">
                                    {value}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 flex-shrink-0"
                                    onClick={() => copyToClipboard(value, `${provider.provider_id}-${label}`)}
                                  >
                                    {copiedField === `${provider.provider_id}-${label}` ? (
                                      <Check className="w-3 h-3 text-green-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : null
                          )}

                          <div className="space-y-1">
                            <span className="text-xs font-medium text-gray-500">Scopes</span>
                            <div className="flex flex-wrap gap-1">
                              {provider.config.scopes?.map((scope) => (
                                <Badge key={scope} variant="outline" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {provider.config.ca_cert_path && (
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-gray-500">CA Certificate</span>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 flex-1 break-all">
                                  {provider.config.ca_cert_path}
                                </code>
                                {provider.config.ca_cert_exists ? (
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Found
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <XCircle className="w-3 h-3" />
                                    Missing
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Test Login */}
                        <div className="border-t pt-4 space-y-4">
                          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Play className="w-4 h-4" />
                            Test Login
                          </h4>
                          <p className="text-xs text-gray-500">
                            Override default parameters for this test. Leave fields blank to use
                            the provider defaults.
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor={`redirect-${provider.provider_id}`}>
                                Redirect URI Override
                              </Label>
                              <Input
                                id={`redirect-${provider.provider_id}`}
                                placeholder={callbackUrl}
                                value={params.redirect_uri}
                                onChange={(e) =>
                                  updateTestParam(provider.provider_id, 'redirect_uri', e.target.value)
                                }
                                className="text-xs h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor={`scopes-${provider.provider_id}`}>
                                Scopes Override
                              </Label>
                              <Input
                                id={`scopes-${provider.provider_id}`}
                                placeholder="openid profile email"
                                value={params.scopes}
                                onChange={(e) =>
                                  updateTestParam(provider.provider_id, 'scopes', e.target.value)
                                }
                                className="text-xs h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor={`response-type-${provider.provider_id}`}>
                                Response Type Override
                              </Label>
                              <Input
                                id={`response-type-${provider.provider_id}`}
                                placeholder="code"
                                value={params.response_type}
                                onChange={(e) =>
                                  updateTestParam(provider.provider_id, 'response_type', e.target.value)
                                }
                                className="text-xs h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor={`client-id-${provider.provider_id}`}>
                                Client ID Override
                              </Label>
                              <Input
                                id={`client-id-${provider.provider_id}`}
                                placeholder={provider.config.client_id}
                                value={params.client_id}
                                onChange={(e) =>
                                  updateTestParam(provider.provider_id, 'client_id', e.target.value)
                                }
                                className="text-xs h-8"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => handleTestLogin(provider.provider_id)}
                              disabled={testingProvider === provider.provider_id || provider.status === 'error'}
                              className="gap-2"
                            >
                              {testingProvider === provider.provider_id ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Redirecting...
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4" />
                                  Start Test Login
                                </>
                              )}
                            </Button>
                            <p className="text-xs text-gray-500">
                              Callback to:{' '}
                              <code className="bg-gray-100 px-1 py-0.5 rounded">
                                {params.redirect_uri || callbackUrl}
                              </code>
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )
            })}

            {/* Callback URL Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 space-y-2">
                    <p className="font-medium">Test Callback URL</p>
                    <p>
                      Configure your OIDC provider to allow this redirect URI for testing:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs">{callbackUrl}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-blue-700"
                        onClick={() => copyToClipboard(callbackUrl, 'callback-url')}
                      >
                        {copiedField === 'callback-url' ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs">
                      After a test login, you will be redirected to the{' '}
                      <Link href="/login/oidc-test-callback" className="underline">
                        OIDC Test Callback Debugger
                      </Link>{' '}
                      where you can inspect tokens and claims.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
