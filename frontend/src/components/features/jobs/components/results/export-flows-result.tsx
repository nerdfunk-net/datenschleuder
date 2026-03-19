"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CheckCircle2,
  XCircle,
  GitBranch,
  FileText,
  Server,
  Download,
} from "lucide-react"
import type { ExportFlowsJobResult } from "../../types/job-results"

interface ExportFlowsResultViewProps {
  result: ExportFlowsJobResult
}

export function ExportFlowsResultView({ result }: ExportFlowsResultViewProps) {
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <p className={`text-lg font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? 'Success' : 'Failed'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Flows Exported</p>
          <p className="text-lg font-semibold text-gray-700">{String(result.exported_count ?? 0)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Format</p>
          <Badge variant="outline" className="mt-1 text-xs uppercase font-mono">
            {result.export_type}
          </Badge>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">NiFi Clusters</p>
          <p className="text-sm font-medium text-gray-700 truncate" title={result.nifi_clusters}>
            {result.nifi_clusters || 'N/A'}
          </p>
        </div>
      </div>

      {/* Status message for success */}
      {result.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            Successfully exported{' '}
            <span className="font-semibold">{result.exported_count}</span> flow
            {result.exported_count !== 1 ? 's' : ''} as{' '}
            <span className="font-semibold uppercase">{result.export_type}</span> to{' '}
            <span className="font-semibold">{result.filename}</span>
            {result.git_repo_name && (
              <> in repository <span className="font-semibold">{result.git_repo_name}</span></>
            )}
            .
          </p>
        </div>
      )}

      {/* Error */}
      {result.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{result.error}</p>
          </div>
        </div>
      )}

      {/* Export Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-teal-500" />
            Export Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Filename
              </span>
              <span className="text-gray-900 font-mono text-xs">{result.filename || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Format</span>
              <Badge variant="outline" className="text-xs uppercase font-mono">
                {result.export_type}
              </Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600 flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" />
                NiFi Clusters
              </span>
              <span className="text-gray-900">{result.nifi_clusters || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-gray-600">Flows Exported</span>
              <span className="text-gray-900 font-semibold">{String(result.exported_count ?? 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Git Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-blue-500" />
            Git Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Repository</span>
              <span className="text-gray-900">{result.git_repo_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-gray-600">Commit SHA</span>
              {result.commit_sha ? (
                <span className="text-gray-900 font-mono text-xs">{result.commit_sha}</span>
              ) : (
                <span className="text-gray-400 text-xs">Not committed</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
