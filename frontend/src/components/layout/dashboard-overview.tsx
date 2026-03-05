'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Activity, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { useJobsQuery } from '@/components/features/jobs/view/hooks/use-jobs-query'
import { isCheckQueuesJobResult, isCheckProcessGroupJobResult } from '@/components/features/jobs/types/job-results'
import type { JobRun } from '@/components/features/jobs/types/job-results'

type StatusColor = 'green' | 'yellow' | 'red' | 'gray'

function getJobStatus(job: JobRun): StatusColor {
  if (job.result && isCheckQueuesJobResult(job.result)) {
    return job.result.overall_status
  }

  if (job.result && isCheckProcessGroupJobResult(job.result)) {
    return job.result.passed ? 'green' : 'red'
  }

  if (job.status === 'running' || job.status === 'pending') return 'yellow'
  if (job.status === 'completed') {
    return job.result && (job.result as { success?: boolean }).success === true ? 'green' : 'red'
  }
  if (job.status === 'failed' || job.status === 'cancelled') return 'red'

  return 'gray'
}

const STATUS_BADGE_CLASSES: Record<StatusColor, string> = {
  green: 'bg-green-100 text-green-800 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
}


const STATUS_HEADER_CLASSES: Record<StatusColor, string> = {
  green: 'from-green-400/80 to-green-500/80',
  yellow: 'from-yellow-400/80 to-yellow-500/80',
  red: 'from-red-400/80 to-red-500/80',
  gray: 'from-gray-400/80 to-gray-500/80',
}

const STATUS_LABELS: Record<StatusColor, string> = {
  green: 'Healthy',
  yellow: 'In Progress',
  red: 'Failed',
  gray: 'No Data',
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Never'
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d ago`
}

const QUERY_PARAMS = { page_size: 100 }

export default function DashboardOverview() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()

  const { data, isLoading } = useJobsQuery({ params: QUERY_PARAMS })

  const jobCards = useMemo(() => {
    if (!data?.items) return []

    // Group by job_name — API returns newest first, so first entry per name = latest run
    const seen = new Map<string, JobRun>()
    for (const job of data.items) {
      if (!seen.has(job.job_name)) {
        seen.set(job.job_name, job)
      }
    }

    return Array.from(seen.values()).sort((a, b) =>
      a.job_name.localeCompare(b.job_name)
    )
  }, [data])

  const pageHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <LayoutDashboard className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {user?.username ? `Welcome, ${user.username}` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-2">Job status overview — auto-refreshes while jobs are active</p>
        </div>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        {/* Blue gradient panel header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">Job Status</span>
          </div>
          <div className="text-xs text-blue-100">
            {jobCards.length > 0
              ? `${jobCards.length} job template${jobCards.length !== 1 ? 's' : ''} monitored — latest run per job name`
              : 'No job runs recorded yet'}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {jobCards.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No job runs found</p>
              <p className="text-sm mt-1">Jobs will appear here once they have been executed</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {jobCards.map((job) => {
                const color = getJobStatus(job)
                const lastRun = job.completed_at ?? job.started_at ?? job.queued_at
                return (
                  <div
                    key={job.job_name}
                    className="shadow-sm border-0 p-0 bg-white rounded-lg hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                    onClick={() => router.push('/jobs/view')}
                  >
                    {/* Card status-colored header */}
                    <div className={`bg-gradient-to-r ${STATUS_HEADER_CLASSES[color]} text-white py-1.5 px-3 flex items-center justify-between`}>
                      <span className="text-xs font-medium truncate">{job.job_name}</span>
                      <span className="text-xs opacity-80 ml-2 shrink-0">{STATUS_LABELS[color]}</span>
                    </div>
                    {/* Card body */}
                    <div className="p-4 bg-gradient-to-b from-white to-gray-50 space-y-2">
                      {job.template_name && (
                        <p className="text-xs text-muted-foreground">{job.template_name}</p>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${STATUS_BADGE_CLASSES[color]}`}
                      >
                        {STATUS_LABELS[color]}
                      </Badge>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>Last run: <span className="font-medium text-slate-700">{formatTimestamp(lastRun)}</span></div>
                        <div>Status: <span className="font-medium text-slate-700 capitalize">{job.status}</span></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
