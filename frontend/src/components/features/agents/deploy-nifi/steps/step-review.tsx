'use client'

import { useCallback } from 'react'
import { FileText, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { useDeployNifiStore } from '../wizard-store'

export function StepReview() {
  const composeContent = useDeployNifiStore((s) => s.composeContent)
  const setComposeContent = useDeployNifiStore((s) => s.setComposeContent)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setComposeContent(e.target.value),
    [setComposeContent]
  )

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Review the generated <code className="font-mono text-xs">docker-compose.yml</code>{' '}
          below. You can edit it directly before deploying.
        </AlertDescription>
      </Alert>

      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">docker-compose.yml</span>
          </div>
          <span className="text-xs text-blue-100">Editable</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <Textarea
            value={composeContent}
            onChange={handleChange}
            rows={32}
            className="font-mono text-sm resize-y"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
