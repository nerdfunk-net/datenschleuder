'use client'

import { Server, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import type { NifiInstance } from '@/components/features/settings/nifi/types'

interface InstanceListProps {
  selectedInstanceId: number | null
  onSelectInstance: (id: number) => void
}

export function InstanceList({ selectedInstanceId, onSelectInstance }: InstanceListProps) {
  const { data: instances, isLoading, isError } = useNifiInstancesQuery()

  const withGitRepo = (instances ?? []).filter((i: NifiInstance) => i.git_config_repo_id !== null)
  const withoutGitRepo = (instances ?? []).filter((i: NifiInstance) => i.git_config_repo_id === null)

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
        <Server className="h-4 w-4" />
        <span className="text-sm font-medium">NiFi Instances</span>
      </div>
      <div className="p-3 bg-gradient-to-b from-white to-gray-50 max-h-64 overflow-y-auto">
        {isLoading && (
          <p className="text-sm text-slate-500 text-center py-4">Loading instances...</p>
        )}
        {isError && (
          <p className="text-sm text-red-500 text-center py-4">Failed to load instances.</p>
        )}
        {!isLoading && !isError && withGitRepo.length === 0 && withoutGitRepo.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">No NiFi instances found.</p>
        )}
        <div className="space-y-1">
          {withGitRepo.map((instance: NifiInstance) => (
            <button
              key={instance.id}
              onClick={() => onSelectInstance(instance.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                selectedInstanceId === instance.id
                  ? 'bg-blue-100 border border-blue-300 text-blue-800'
                  : 'hover:bg-slate-100 text-slate-700'
              )}
            >
              <div className="font-medium">{instance.name ?? `Instance #${instance.id}`}</div>
              <div className="text-xs text-slate-500 truncate">{instance.nifi_url}</div>
            </button>
          ))}
          {withoutGitRepo.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                No git repo configured:
              </p>
              {withoutGitRepo.map((instance: NifiInstance) => (
                <div
                  key={instance.id}
                  className="px-3 py-2 rounded-md text-sm text-slate-400 cursor-not-allowed"
                >
                  <div className="font-medium">{instance.name ?? `Instance #${instance.id}`}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
