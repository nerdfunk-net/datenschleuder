'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useImportTreeQuery, type TreeNode } from '../hooks/use-import-tree-query'

interface FileMeta {
  name: string
  path: string
  size: number
}

interface DirectoryContents {
  path: string
  files: FileMeta[]
  directory_exists: boolean
}

function isImportable(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.json') || lower.endsWith('.csv')
}

interface DirNodeProps {
  repoId: number
  node: TreeNode
  selectedFile: string | null
  onSelectFile: (path: string | null) => void
  depth: number
}

function DirNode({ repoId, node, selectedFile, onSelectFile, depth }: DirNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const { apiCall } = useApi()

  const { data: dirData, isLoading: filesLoading } = useQuery({
    queryKey: [...queryKeys.flows.importTree(repoId, node.path), 'files'],
    queryFn: () => {
      const pathParam = node.path ? `&path=${encodeURIComponent(node.path)}` : ''
      return apiCall<DirectoryContents>(`git/${repoId}/directory?${pathParam}`, { method: 'GET' })
    },
    enabled: expanded,
    staleTime: 30 * 1000,
  })

  const files = useMemo(() => dirData?.files ?? [], [dirData])
  const hasContent = node.file_count > 0 || node.children.length > 0

  return (
    <div>
      <button
        className={cn(
          'flex items-center gap-1.5 w-full text-left text-sm px-2 py-1 rounded hover:bg-muted transition-colors',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-yellow-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
        )}
        <span className="truncate">{node.name}</span>
        {hasContent && (
          <span className="ml-auto text-xs text-muted-foreground">{node.file_count}</span>
        )}
      </button>

      {expanded && (
        <div>
          {filesLoading && (
            <div
              className="flex items-center gap-1.5 text-xs text-muted-foreground py-1"
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          )}

          {/* Files */}
          {files.map((file) => {
            const selectable = isImportable(file.name)
            const selected = selectedFile === file.path
            return (
              <button
                key={file.path}
                className={cn(
                  'flex items-center gap-1.5 w-full text-left text-sm px-2 py-1 rounded transition-colors',
                  selectable
                    ? selected
                      ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                      : 'hover:bg-muted'
                    : 'opacity-40 cursor-not-allowed',
                )}
                style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
                disabled={!selectable}
                onClick={() => selectable && onSelectFile(selected ? null : file.path)}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
              </button>
            )
          })}

          {/* Subdirectories */}
          {node.children.map((child) => (
            <DirNode
              key={child.path}
              repoId={repoId}
              node={child}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileBrowserProps {
  repoId: number
  selectedFile: string | null
  onSelectFile: (path: string | null) => void
}

export function FileBrowser({ repoId, selectedFile, onSelectFile }: FileBrowserProps) {
  const { data: tree, isLoading, isError } = useImportTreeQuery(repoId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading repository…
      </div>
    )
  }

  if (isError || !tree) {
    return (
      <p className="text-sm text-destructive py-2">Failed to load repository tree.</p>
    )
  }

  if (tree.children.length === 0 && tree.file_count === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Repository appears to be empty.</p>
    )
  }

  return (
    <div className="border rounded-md p-2 bg-background max-h-72 overflow-y-auto space-y-0.5">
      {/* Root-level files */}
      <RootFiles repoId={repoId} selectedFile={selectedFile} onSelectFile={onSelectFile} />

      {/* Directories */}
      {tree.children.map((child) => (
        <DirNode
          key={child.path}
          repoId={repoId}
          node={child}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          depth={0}
        />
      ))}
    </div>
  )
}

function RootFiles({
  repoId,
  selectedFile,
  onSelectFile,
}: {
  repoId: number
  selectedFile: string | null
  onSelectFile: (path: string | null) => void
}) {
  const { apiCall } = useApi()
  const { data } = useQuery({
    queryKey: [...queryKeys.flows.importTree(repoId), 'root-files'],
    queryFn: () => apiCall<DirectoryContents>(`git/${repoId}/directory?`, { method: 'GET' }),
    staleTime: 30 * 1000,
  })

  const files = data?.files ?? []
  return (
    <>
      {files.map((file) => {
        const selectable = isImportable(file.name)
        const selected = selectedFile === file.path
        return (
          <button
            key={file.path}
            className={cn(
              'flex items-center gap-1.5 w-full text-left text-sm px-2 py-1 rounded transition-colors',
              selectable
                ? selected
                  ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                  : 'hover:bg-muted'
                : 'opacity-40 cursor-not-allowed',
            )}
            disabled={!selectable}
            onClick={() => selectable && onSelectFile(selected ? null : file.path)}
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.name}</span>
          </button>
        )
      })}
    </>
  )
}
