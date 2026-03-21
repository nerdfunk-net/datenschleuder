'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Settings } from 'lucide-react'
import type { DebugResponse } from '../types/oidc-types'

interface StatusOverviewProps {
  debugInfo: DebugResponse | undefined
}

export function StatusOverview({ debugInfo }: StatusOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">OIDC Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {debugInfo?.oidc_enabled ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">Enabled</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-2xl font-bold text-red-600">Disabled</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold text-gray-900">
              {debugInfo?.providers.length || 0}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Traditional Login</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {debugInfo?.allow_traditional_login ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">Allowed</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-gray-400" />
                <span className="text-2xl font-bold text-gray-600">Disabled</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
