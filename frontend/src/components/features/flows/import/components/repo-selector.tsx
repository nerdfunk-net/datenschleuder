'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useImportReposQuery } from '../hooks/use-import-repos-query'

interface RepoSelectorProps {
  value: number | null
  onChange: (repoId: number | null) => void
}

export function RepoSelector({ value, onChange }: RepoSelectorProps) {
  const { data, isLoading } = useImportReposQuery()
  const repositories = data?.repositories ?? []

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Import Repository</label>
      <Select
        value={value !== null ? String(value) : ''}
        onValueChange={(v) => onChange(v ? Number(v) : null)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={isLoading ? 'Loading…' : 'Select a repository'} />
        </SelectTrigger>
        <SelectContent>
          {repositories.map((repo) => (
            <SelectItem key={repo.id} value={String(repo.id)}>
              {repo.name}
            </SelectItem>
          ))}
          {repositories.length === 0 && !isLoading && (
            <div className="py-2 px-3 text-sm text-muted-foreground">
              No repositories with category &quot;import&quot; found.
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
