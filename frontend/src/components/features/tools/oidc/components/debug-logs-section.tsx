'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { getLevelIcon } from '../utils/oidc-icon-helpers'
import type { DebugLog } from '../types/oidc-types'

interface DebugLogsSectionProps {
  logs: DebugLog[]
}

export function DebugLogsSection({ logs }: DebugLogsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Debug Logs
        </CardTitle>
        <CardDescription>Real-time authentication flow events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              {getLevelIcon(log.level)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">{log.message}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {log.details && (
                  <pre className="text-xs text-gray-600 font-mono bg-white p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No logs yet. Interact with the page to see debug information.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
