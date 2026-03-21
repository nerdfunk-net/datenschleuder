import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Key, RefreshCw } from 'lucide-react'

interface ApiKeySectionProps {
  apiKey: string
  onChange: (value: string) => void
  onGenerate: () => void
}

export function ApiKeySection({ apiKey, onChange, onGenerate }: ApiKeySectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="api_key" className="flex items-center space-x-2">
        <Key className="h-4 w-4" />
        <span>API Key</span>
      </Label>
      <div className="flex space-x-2">
        <Input
          id="api_key"
          type="text"
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your 42-character API key"
          className="font-mono text-sm"
          maxLength={42}
        />
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={onGenerate}
          className="shrink-0 px-3"
          title="Generate new API key"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between text-sm">
        <p className="text-slate-500">
          Leave empty for no API key, or enter exactly 42 characters
        </p>
        <span className={`font-mono ${
          apiKey.length === 0
            ? 'text-slate-400'
            : apiKey.length === 42
              ? 'text-green-600'
              : 'text-red-600'
        }`}>
          {apiKey.length}/42
        </span>
      </div>
      {apiKey.length > 0 && apiKey.length !== 42 && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          API key must be exactly 42 characters long
        </div>
      )}
    </div>
  )
}

interface TokensCardProps {
  apiKey: string
  onApiKeyChange: (value: string) => void
  onApiKeyGenerate: () => void
  children: React.ReactNode
}

export function TokensCard({ apiKey, onApiKeyChange, onApiKeyGenerate, children }: TokensCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center space-x-2 text-white text-base">
          <Key className="h-5 w-5" />
          <span>Tokens & Credentials</span>
        </CardTitle>
        <CardDescription className="text-blue-100">
          Manage your API keys and access tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ApiKeySection apiKey={apiKey} onChange={onApiKeyChange} onGenerate={onApiKeyGenerate} />
        {children}
      </CardContent>
    </Card>
  )
}
