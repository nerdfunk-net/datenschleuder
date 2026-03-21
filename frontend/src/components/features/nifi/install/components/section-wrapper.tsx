'use client'

import { useState, useCallback, useMemo, type ReactNode } from 'react'
import {
  useCheckPathQuery,
  useParameterContextsQuery,
  useRegistryFlowsByInstanceQuery,
} from '../hooks/use-install-query'
import { PathSection } from './path-section'
import type { NifiCluster } from '@/components/features/settings/nifi/types'
import type { RegistryFlow } from '@/components/features/flows/manage/types'
import type { ParameterContext } from '../types'

const EMPTY_REGISTRY_FLOWS: RegistryFlow[] = []
const EMPTY_PARAM_CONTEXTS: ParameterContext[] = []

export interface SectionWrapperProps {
  clusters: NifiCluster[]
  pathType: 'source' | 'destination'
  title: string
  icon: ReactNode
  gradientClass: string
  onDeployRequest: (
    clusterId: number,
    primaryInstanceId: number,
    path: string,
    flowId: number,
    paramContextId: string | null,
  ) => Promise<void>
  deployingPaths: Set<string>
}

export function SectionWrapper({
  clusters,
  pathType,
  title,
  icon,
  gradientClass,
  onDeployRequest,
  deployingPaths,
}: SectionWrapperProps) {
  const [clusterId, setClusterId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  const primaryInstanceId = useMemo(
    () =>
      clusters
        .find((c) => c.id === clusterId)
        ?.members.find((m) => m.is_primary)?.instance_id ?? null,
    [clusters, clusterId],
  )

  const { data: pathData, isLoading: isLoadingPaths, refetch } = useCheckPathQuery(
    clusterId,
    pathType,
    false,
  )
  const { data: registryFlows = EMPTY_REGISTRY_FLOWS, isLoading: isLoadingFlows } =
    useRegistryFlowsByInstanceQuery(primaryInstanceId)
  const { data: paramContexts = EMPTY_PARAM_CONTEXTS, isLoading: isLoadingParams } =
    useParameterContextsQuery(primaryInstanceId)

  const handleClusterChange = useCallback((id: number | null) => {
    setClusterId(id)
    setHasChecked(false)
  }, [])

  const handleReload = useCallback(() => {
    setHasChecked(true)
    refetch()
  }, [refetch])

  const handleDeploy = useCallback(
    async (path: string, flowId: number, paramContextId: string | null) => {
      if (!clusterId || !primaryInstanceId) return
      await onDeployRequest(clusterId, primaryInstanceId, path, flowId, paramContextId)
      refetch()
    },
    [clusterId, primaryInstanceId, onDeployRequest, refetch],
  )

  return (
    <PathSection
      title={title}
      icon={icon}
      gradientClass={gradientClass}
      clusters={clusters}
      selectedClusterId={clusterId}
      onClusterChange={handleClusterChange}
      pathStatuses={pathData?.status ?? []}
      isLoadingPaths={isLoadingPaths}
      hasChecked={hasChecked}
      registryFlows={registryFlows}
      isLoadingFlows={isLoadingFlows}
      paramContexts={paramContexts}
      isLoadingParams={isLoadingParams}
      deployingPaths={deployingPaths}
      onDeploy={handleDeploy}
      onReload={handleReload}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
    />
  )
}
