'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function CommonSettingsForm() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Common Settings</h1>
            <p className="text-muted-foreground">
              General application settings
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-600">
              This page is a placeholder for common application settings.
            </p>
            <p className="text-slate-600">
              Add your custom settings forms and configuration options here based on your application needs.
            </p>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900 mb-2">Getting Started</p>
              <p className="text-sm text-blue-800">
                Edit this component at:{' '}
                <code className="text-xs bg-white px-2 py-1 rounded">
                  /frontend/src/components/features/settings/common/common-settings.tsx
                </code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
