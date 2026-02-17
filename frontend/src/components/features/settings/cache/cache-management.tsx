'use client'

import { Zap } from 'lucide-react'
import { CacheSettingsForm } from './components/cache-settings-form'

export default function CacheManagement() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-100 p-2 rounded-lg">
            <Zap className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cache Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure basic cache settings for your application
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="max-w-2xl">
        <CacheSettingsForm />
      </div>
    </div>
  )
}
