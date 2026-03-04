'use client'

import { FolderOpen, Key, FileText, Loader2, RefreshCw, CheckCircle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import { useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import { useCertFilesQuery } from '../hooks/use-cert-files-query'
import type { CertFileInfo } from '../types'

interface FileBrowserProps {
  instanceId: number | null
  selectedFilePath: string | null
  filePassword: string
  autoDetectedKey: string | null
  onSelectFile: (path: string) => void
  onPasswordChange: (password: string) => void
}

function FileIcon({ fileType }: { fileType: string }) {
  if (fileType === 'p12') {
    return <Key className="h-4 w-4 text-amber-500 flex-shrink-0" />
  }
  return <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
}

export function FileBrowser({
  instanceId,
  selectedFilePath,
  filePassword,
  autoDetectedKey,
  onSelectFile,
  onPasswordChange,
}: FileBrowserProps) {
  const { data, isLoading, isError } = useCertFilesQuery(instanceId)
  const { data: instances } = useNifiInstancesQuery()
  const { apiCall } = useApi()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const selectedInstance = (instances ?? []).find((i) => i.id === instanceId)
  const gitRepoId = selectedInstance?.git_config_repo_id ?? null

  const pullRepo = useMutation({
    mutationFn: () => apiCall(`git/${gitRepoId}/sync`, { method: 'POST' }),
    onSuccess: () => {
      if (instanceId !== null) {
        queryClient.invalidateQueries({ queryKey: queryKeys.certManager.files(instanceId) })
      }
      toast({ title: 'Pulled', description: 'Git repository synced successfully.' })
    },
    onError: (error: Error) => {
      toast({ title: 'Pull failed', description: error.message, variant: 'destructive' })
    },
  })

  const files = data?.files ?? []
  const selectedFile = files.find((f) => f.path === selectedFilePath)

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <FolderOpen className="h-4 w-4" />
          <span className="text-sm font-medium">Certificate Files</span>
        </div>
        {gitRepoId !== null && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-white hover:bg-white/20 hover:text-white"
            onClick={() => pullRepo.mutate()}
            disabled={pullRepo.isPending}
          >
            <RefreshCw className={cn('h-3 w-3 mr-1', pullRepo.isPending && 'animate-spin')} />
            Pull
          </Button>
        )}
      </div>
      <div className="p-3 bg-gradient-to-b from-white to-gray-50">
        {instanceId === null && (
          <p className="text-sm text-slate-400 text-center py-4">
            Select a NiFi instance to browse files.
          </p>
        )}

        {instanceId !== null && isLoading && (
          <div className="flex items-center justify-center py-4 text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading files...</span>
          </div>
        )}

        {instanceId !== null && isError && (
          <p className="text-sm text-red-500 text-center py-4">
            Failed to load files. Is a git repo configured?
          </p>
        )}

        {instanceId !== null && !isLoading && !isError && files.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">
            No *.pem or *.p12 files found in the git repository.
          </p>
        )}

        {files.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {files.map((file: CertFileInfo) => (
              <button
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2',
                  selectedFilePath === file.path
                    ? 'bg-blue-100 border border-blue-300 text-blue-800'
                    : 'hover:bg-slate-100 text-slate-700'
                )}
              >
                <FileIcon fileType={file.file_type} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  {file.path !== file.name && (
                    <div className="text-xs text-slate-400 truncate">{file.path}</div>
                  )}
                  {file.size !== null && (
                    <div className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedFile?.file_type === 'p12' && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
            <Label htmlFor="p12-password" className="text-xs text-slate-600">
              P12 Password (optional)
            </Label>
            {autoDetectedKey && (
              <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                <CheckCircle className="h-3 w-3 flex-shrink-0" />
                <span>Auto-detected from <code className="font-mono">{autoDetectedKey}</code></span>
              </div>
            )}
            <Input
              id="p12-password"
              type="password"
              placeholder="Leave blank if unencrypted"
              value={filePassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  )
}
