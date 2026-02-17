'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileEdit } from 'lucide-react'

export default function TemplateEditorRoute() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <FileEdit className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Template Editor</h1>
            <p className="text-muted-foreground">
              Create and edit configuration templates
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Template Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-600">
              This page is a placeholder for the template editor functionality.
            </p>
            <p className="text-slate-600">
              Build your custom template editor here with features like:
            </p>
            <ul className="text-slate-600 space-y-2 mt-4">
              <li>Monaco or CodeMirror editor for syntax highlighting</li>
              <li>Template preview and validation</li>
              <li>Variable substitution testing</li>
              <li>Template versioning</li>
              <li>Save and load functionality</li>
            </ul>
            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="font-medium text-purple-900 mb-2">Getting Started</p>
              <p className="text-sm text-purple-800">
                Edit this component at:{' '}
                <code className="text-xs bg-white px-2 py-1 rounded">
                  /frontend/src/app/(dashboard)/settings/templates/editor/page.tsx
                </code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
