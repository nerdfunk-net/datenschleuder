'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  FileText,
  ExternalLink,
  LogIn,
  RefreshCw,
} from 'lucide-react'
import type { ProviderDebugInfo } from '../types/oidc-types'
import type { UseOidcTestParametersReturn } from '../hooks/use-oidc-test-parameters'

interface ConfigurationDetailsProps {
  provider: ProviderDebugInfo
  testParams: UseOidcTestParametersReturn
  testingProvider: string | null
  onTestLogin: (
    providerId: string,
    overrides?: Record<string, unknown>,
  ) => void
}

export function ConfigurationDetails({
  provider,
  testParams,
  testingProvider,
  onTestLogin,
}: ConfigurationDetailsProps) {
  const {
    useCustomParams,
    setUseCustomParams,
    useDebugCallback,
    setUseDebugCallback,
    customRedirectUri,
    setCustomRedirectUri,
    customScopes,
    setCustomScopes,
    customResponseType,
    setCustomResponseType,
    customClientId,
    setCustomClientId,
  } = testParams

  const handleTestLogin = () => {
    const overrides: Record<string, unknown> = {}

    if (useDebugCallback) {
      overrides.redirect_uri = `${window.location.origin}/login/oidc-test-callback`
    }

    if (useCustomParams) {
      if (customClientId) overrides.client_id = customClientId
      if (customScopes) overrides.scopes = customScopes.split(' ').filter((s) => s)
      if (customResponseType) overrides.response_type = customResponseType
      if (customRedirectUri && !useDebugCallback) overrides.redirect_uri = customRedirectUri
    }

    if (Object.keys(overrides).length > 0) {
      onTestLogin(provider.provider_id, overrides)
    } else {
      onTestLogin(provider.provider_id)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Configuration Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="test">Test Login</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
            {provider.issues.length > 0 && (
              <Alert className="border-red-500 bg-red-50 text-red-900">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription>
                  <div className="font-semibold mb-1">Configuration Issues:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {provider.issues.map((issue) => (
                      <li key={issue} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {[
                { label: 'Provider ID', value: provider.provider_id, mono: true },
                { label: 'Name', value: provider.name, mono: false },
                { label: 'Client ID', value: provider.config.client_id || 'Not configured', mono: true },
                { label: 'Issuer', value: provider.config.issuer || 'Not configured', mono: true },
                { label: 'Scopes', value: provider.config.scopes?.join(', ') || 'None', mono: true },
                { label: 'Response Type', value: provider.config.response_type || 'code', mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between py-2 border-b">
                  <span className="text-sm font-medium text-gray-600">{label}</span>
                  <span className={`text-sm ${mono ? 'font-mono' : ''} text-right max-w-sm truncate`}>
                    {value}
                  </span>
                </div>
              ))}

              <div className="flex justify-between py-2 border-b">
                <span className="text-sm font-medium text-gray-600">Custom CA Certificate</span>
                <div className="flex items-center gap-2">
                  {provider.config.ca_cert_path ? (
                    <>
                      {provider.config.ca_cert_exists ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm font-mono">
                        {provider.config.ca_cert_exists ? 'Configured' : 'File not found'}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">Not configured</span>
                  )}
                </div>
              </div>
              {provider.config.ca_cert_path && (
                <div className="text-xs font-mono text-gray-500 pl-4">
                  {provider.config.ca_cert_path}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-3 mt-4">
            {[
              { label: 'Authorization', url: provider.config.authorization_endpoint },
              { label: 'Token', url: provider.config.token_endpoint },
              { label: 'UserInfo', url: provider.config.userinfo_endpoint },
              { label: 'JWKS', url: provider.config.jwks_uri },
            ].map(({ label, url }) => (
              <div key={label} className="space-y-1">
                <div className="text-sm font-medium text-gray-600">{label} Endpoint</div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-mono text-blue-600 hover:text-blue-700 break-all p-2 bg-blue-50 rounded border border-blue-200"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    {url}
                  </a>
                ) : (
                  <div className="text-sm text-gray-400 italic p-2 bg-gray-50 rounded">
                    Not configured
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="test" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This will redirect you to the OIDC provider for authentication. Make sure your
                callback URL is properly configured.
              </AlertDescription>
            </Alert>

            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Checkbox
                id="use-debug-callback"
                checked={useDebugCallback}
                onCheckedChange={(checked) => setUseDebugCallback(checked as boolean)}
              />
              <Label htmlFor="use-debug-callback" className="text-sm font-medium cursor-pointer">
                Use /login/oidc-test-callback for detailed debugging
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Checkbox
                id="use-custom-params"
                checked={useCustomParams}
                onCheckedChange={(checked) => setUseCustomParams(checked as boolean)}
              />
              <Label htmlFor="use-custom-params" className="text-sm font-medium cursor-pointer">
                Override default parameters for testing
              </Label>
            </div>

            {useCustomParams && (
              <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="custom-client-id" className="text-sm font-medium">
                    Client ID
                  </Label>
                  <Input
                    id="custom-client-id"
                    type="text"
                    placeholder={provider.config.client_id || 'Enter custom client ID'}
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to use default: {provider.config.client_id}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-scopes" className="text-sm font-medium">
                    Scopes (space-separated)
                  </Label>
                  <Input
                    id="custom-scopes"
                    type="text"
                    placeholder={provider.config.scopes?.join(' ') || 'openid profile email'}
                    value={customScopes}
                    onChange={(e) => setCustomScopes(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Default: {provider.config.scopes?.join(' ') || 'openid profile email'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-response-type" className="text-sm font-medium">
                    Response Type
                  </Label>
                  <Input
                    id="custom-response-type"
                    type="text"
                    placeholder="code"
                    value={customResponseType}
                    onChange={(e) => setCustomResponseType(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">Default: code</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-redirect-uri" className="text-sm font-medium">
                    Redirect URI
                  </Label>
                  <Input
                    id="custom-redirect-uri"
                    type="text"
                    placeholder="http://localhost:3000/login/callback"
                    value={customRedirectUri}
                    onChange={(e) => setCustomRedirectUri(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">Leave empty to use system default</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleTestLogin}
              disabled={testingProvider !== null || provider.status === 'error'}
              className="w-full gap-2"
            >
              {testingProvider === provider.provider_id ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {useDebugCallback || useCustomParams
                    ? 'Test with Custom Parameters'
                    : `Test Login with ${provider.name}`}
                </>
              )}
            </Button>

            {provider.status === 'error' && (
              <p className="text-sm text-red-600 text-center">
                Fix configuration issues before testing
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

