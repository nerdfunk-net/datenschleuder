'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'
import type { DebugResponse } from '../types/oidc-types'

interface GlobalConfigSectionProps {
  globalConfig: DebugResponse['global_config'] | undefined
}

export function GlobalConfigSection({ globalConfig }: GlobalConfigSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Global Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Auto-create Users</span>
            <Badge variant={globalConfig?.auto_create_users ? 'default' : 'secondary'}>
              {globalConfig?.auto_create_users ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Update User Info</span>
            <Badge variant={globalConfig?.update_user_info ? 'default' : 'secondary'}>
              {globalConfig?.update_user_info ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Default Role</span>
            <Badge variant="outline">{globalConfig?.default_role || 'user'}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
