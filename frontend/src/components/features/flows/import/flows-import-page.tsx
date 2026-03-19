'use client'

import { useCallback, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { RepoSelector } from './components/repo-selector'
import { FileBrowser } from './components/file-browser'
import { ImportResultTable } from './components/import-result-table'
import { useImportMutations } from './hooks/use-import-mutations'
import type { FlowImportResponse } from './types'

export function FlowsImportPage() {
  const { toast } = useToast()
  const { runImport } = useImportMutations()

  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [result, setResult] = useState<FlowImportResponse | null>(null)

  const handleRepoChange = useCallback((repoId: number | null) => {
    setSelectedRepoId(repoId)
    setSelectedFile(null)
    setResult(null)
  }, [])

  const handleFileSelect = useCallback((path: string | null) => {
    setSelectedFile(path)
    setResult(null)
  }, [])

  const canRun = selectedRepoId !== null && selectedFile !== null && !runImport.isPending

  const handleRun = useCallback(
    (dryRun: boolean) => {
      if (!selectedRepoId || !selectedFile) return
      runImport.mutate(
        { repo_id: selectedRepoId, file_path: selectedFile, dry_run: dryRun },
        {
          onSuccess: (data) => {
            setResult(data)
            toast({
              title: dryRun ? 'Dry run complete' : 'Import complete',
              description: `${data.created} created, ${data.skipped} skipped, ${data.errors} errors`,
            })
          },
        },
      )
    },
    [selectedRepoId, selectedFile, runImport, toast],
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Download className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Import Flows</h1>
            <p className="text-muted-foreground mt-2">
              Browse a Git repository and import flow definitions from a JSON or CSV file.
            </p>
          </div>
        </div>
      </div>

      {/* File Selection Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Select File</span>
          </div>
          <div className="text-xs text-blue-100">
            Choose a .json or .csv flow export file from a Git repository
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          <RepoSelector value={selectedRepoId} onChange={handleRepoChange} />

          {selectedRepoId !== null && (
            <div className="space-y-2">
              <label className="text-sm font-medium">File</label>
              <FileBrowser
                repoId={selectedRepoId}
                selectedFile={selectedFile}
                onSelectFile={handleFileSelect}
              />
              {selectedFile && (
                <p className="text-xs text-gray-500 truncate">
                  Selected: <span className="font-mono">{selectedFile}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              disabled={!canRun}
              onClick={() => handleRun(true)}
            >
              {runImport.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running…
                </>
              ) : (
                'Dry Run'
              )}
            </Button>
            <Button
              disabled={!canRun}
              onClick={() => handleRun(false)}
            >
              {runImport.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import Flows
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Result Section */}
      {result && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">
                {result.dry_run ? 'Preview (Dry Run)' : 'Import Result'}
              </span>
            </div>
            <div className="text-xs text-blue-100">
              {result.dry_run
                ? 'No changes were made to the database'
                : 'Flows have been written to the database'}
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <ImportResultTable result={result} />
          </div>
        </div>
      )}
    </div>
  )
}
