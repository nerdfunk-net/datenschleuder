'use client'

import { useState, useCallback } from 'react'
import { Download, Upload, HardDriveDownload, AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useNifiClustersQuery } from '@/components/features/settings/nifi/hooks/use-nifi-clusters-query'
import { useDeployFlowMutation } from './hooks/use-install-mutations'
import { SectionWrapper } from './components/section-wrapper'
import type { NifiCluster } from '@/components/features/settings/nifi/types'

const EMPTY_CLUSTERS: NifiCluster[] = []

export function NifiInstallPage() {
  const [deployingPaths, setDeployingPaths] = useState<Set<string>>(new Set())

  const { data: clustersData, isLoading: isLoadingClusters } = useNifiClustersQuery()
  const clusters = clustersData ?? EMPTY_CLUSTERS

  const deployMutation = useDeployFlowMutation()

  const handleDeployRequest = useCallback(
    async (
      clusterId: number,
      primaryInstanceId: number,
      path: string,
      flowId: number,
      paramContextId: string | null,
    ) => {
      setDeployingPaths((prev) => new Set([...prev, path]))
      try {
        await deployMutation.mutateAsync({
          clusterId,
          instanceId: primaryInstanceId,
          missingPath: path,
          flowId,
          parameterContextId: paramContextId,
          hierarchyAttribute: null,
        })
      } finally {
        setDeployingPaths((prev) => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
      }
    },
    [deployMutation],
  )

  if (isLoadingClusters) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <HardDriveDownload className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">NiFi Install</h1>
            <p className="text-muted-foreground mt-2">
              Check and create process groups for flow hierarchy paths
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <HardDriveDownload className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">NiFi Install</h1>
            <p className="text-muted-foreground mt-2">
              Check and create process groups for flow hierarchy paths
            </p>
          </div>
        </div>
      </div>

      {/* Info alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Note:</strong> Only configured flows are checked. You need at least one flow
          configured in the{' '}
          <a href="/flows/manage" className="underline font-medium">
            Flow Management
          </a>{' '}
          page to see the hierarchy paths here.
        </AlertDescription>
      </Alert>

      {/* Source Path Panel */}
      <SectionWrapper
        clusters={clusters}
        pathType="source"
        title="Source Path"
        icon={<Upload className="h-4 w-4" />}
        gradientClass="bg-gradient-to-r from-blue-400/80 to-blue-500/80"
        onDeployRequest={handleDeployRequest}
        deployingPaths={deployingPaths}
      />

      {/* Destination Path Panel */}
      <SectionWrapper
        clusters={clusters}
        pathType="destination"
        title="Destination Path"
        icon={<Download className="h-4 w-4" />}
        gradientClass="bg-gradient-to-r from-green-400/80 to-green-500/80"
        onDeployRequest={handleDeployRequest}
        deployingPaths={deployingPaths}
      />
    </div>
  )
}
