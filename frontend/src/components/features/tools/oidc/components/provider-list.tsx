'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Key } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStatusIcon } from '../utils/oidc-icon-helpers'
import type { ProviderDebugInfo } from '../types/oidc-types'

interface ProviderListProps {
  providers: ProviderDebugInfo[]
  selectedProvider: string | null
  onSelectProvider: (providerId: string) => void
}

export function ProviderList({ providers, selectedProvider, onSelectProvider }: ProviderListProps) {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          Providers
        </CardTitle>
        <CardDescription>Click to view configuration details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {providers.map((provider) => (
          <button
            key={provider.provider_id}
            onClick={() => onSelectProvider(provider.provider_id)}
            className={cn(
              'w-full p-3 rounded-lg border-2 text-left transition-all',
              selectedProvider === provider.provider_id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white',
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900">{provider.name}</span>
              {getStatusIcon(provider.status)}
            </div>
            <p className="text-xs text-gray-500">{provider.provider_id}</p>
            {provider.issues.length > 0 && (
              <Badge variant="destructive" className="mt-2 text-xs">
                {provider.issues.length} issue(s)
              </Badge>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
