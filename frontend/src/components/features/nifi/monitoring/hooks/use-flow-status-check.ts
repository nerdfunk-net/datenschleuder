import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { getFlowItemKey, determineFlowStatus } from '../utils/flow-status-utils'
import type {
  Flow,
  FlowType,
  ProcessGroupStatus,
  DeploySettings,
  HierarchyConfig,
  AllPathsResponse,
} from '../types'

interface UseFlowStatusCheckReturn {
  flowStatuses: Record<string, ProcessGroupStatus>
  checking: boolean
  checkError: string | null
  checkAllFlows: (clusterId: number) => Promise<void>
  getFlowItemStatus: (flow: Flow, flowType: FlowType) => ProcessGroupStatus | undefined
  healthyCount: number
  unhealthyCount: number
  unknownCount: number
}

export function useFlowStatusCheck(flows: Flow[]): UseFlowStatusCheckReturn {
  const { apiCall } = useApi()
  const [flowStatuses, setFlowStatuses] = useState<Record<string, ProcessGroupStatus>>({})
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const getFlowItemStatus = useCallback(
    (flow: Flow, flowType: FlowType): ProcessGroupStatus | undefined =>
      flowStatuses[getFlowItemKey(flow.id, flowType)],
    [flowStatuses],
  )

  const healthyCount = useMemo(
    () => Object.values(flowStatuses).filter((s) => determineFlowStatus(s) === 'healthy').length,
    [flowStatuses],
  )
  const unhealthyCount = useMemo(
    () =>
      Object.values(flowStatuses).filter((s) =>
        ['unhealthy', 'issues'].includes(determineFlowStatus(s)),
      ).length,
    [flowStatuses],
  )
  const unknownCount = useMemo(
    () => flows.length * 2 - Object.keys(flowStatuses).length,
    [flows, flowStatuses],
  )

  const checkAllFlows = useCallback(
    async (clusterId: number) => {
      setChecking(true)
      setCheckError(null)
      setFlowStatuses({})

      try {
        const [settingsResponse, hierarchyResponse] = await Promise.all([
          apiCall<DeploySettings>('nifi/hierarchy/deploy'),
          apiCall<HierarchyConfig>('nifi/hierarchy/'),
        ])

        const primaryRes = await apiCall<{ instance_id: number }>(
          `nifi/clusters/${clusterId}/get-primary`,
        )
        const instanceId = primaryRes.instance_id

        const allPathsResponse = await apiCall<AllPathsResponse>(
          `nifi/instances/${instanceId}/ops/process-groups/all-paths`,
        )

        console.log('🔍 [DEBUG] All paths response:', allPathsResponse)

        const pathToIdMap = new Map<string, string>()
        const idToPathMap = new Map<string, string>()
        allPathsResponse.process_groups.forEach((pg) => {
          const pathString = pg.path.startsWith('/') ? pg.path.slice(1) : pg.path
          pathToIdMap.set(pathString, pg.id)
          idToPathMap.set(pg.id, pathString)
        })

        console.log('🗺️ [DEBUG] Path to ID map:', Object.fromEntries(pathToIdMap))
        console.log('🗺️ [DEBUG] ID to Path map:', Object.fromEntries(idToPathMap))

        const deploymentPaths = settingsResponse.paths
        const hierarchyConfig = hierarchyResponse.hierarchy.sort((a, b) => a.order - b.order)

        const clusterDeploymentPath = deploymentPaths[clusterId] ?? deploymentPaths[clusterId.toString()]

        console.log('⚙️ [DEBUG] Deployment paths:', deploymentPaths)
        console.log('📋 [DEBUG] Hierarchy config:', hierarchyConfig)
        console.log('🎯 [DEBUG] Cluster deployment path:', clusterDeploymentPath)

        if (!clusterDeploymentPath) {
          setCheckError(
            `No deployment path configured for cluster ${clusterId}. Open Settings → Deploy, load paths for this cluster and save.`,
          )
          return
        }

        console.log('🔍 [DEBUG] Source path object:', clusterDeploymentPath.source_path)
        console.log('🔍 [DEBUG] Dest path object:', clusterDeploymentPath.dest_path)

        const newStatuses: Record<string, ProcessGroupStatus> = {}

        const checkPart = async (flow: Flow, flowType: FlowType) => {
          const pathConfig =
            flowType === 'source'
              ? clusterDeploymentPath.source_path
              : clusterDeploymentPath.dest_path

          console.log(`\n🔄 [DEBUG] Checking flow #${flow.id} (${flowType})`)
          console.log(`   Path config:`, pathConfig)

          const storedId = pathConfig.id
          let basePath = idToPathMap.get(storedId)

          if (!basePath) {
            console.warn(`   ⚠️ Could not resolve path from ID "${storedId}", falling back to stored raw_path`)
            const rawPath = (pathConfig as Record<string, unknown>).raw_path as string | undefined
            basePath = (rawPath || pathConfig.path || '') as string
            if (basePath && basePath.startsWith('/')) {
              basePath = basePath.slice(1)
            }
            if (basePath) {
              basePath = basePath.replace(/^NiFi Flow → /, '')
            }
          }

          console.log(`   Resolved basePath: "${basePath}"`)

          const hierarchyParts: string[] = []
          const sourceOrDest = flowType === 'source' ? 'source' : 'destination'

          for (let i = 1; i < hierarchyConfig.length; i++) {
            const attr = hierarchyConfig[i]
            if (!attr) continue
            const hierarchyName = attr.name
            const hierarchyValues = (flow as Record<string, unknown>).hierarchy_values as
              | Record<string, Record<string, string>>
              | undefined
            const attrValue = hierarchyValues?.[hierarchyName]?.[sourceOrDest]
            if (attrValue) hierarchyParts.push(attrValue)
          }

          console.log(`   Hierarchy parts:`, hierarchyParts)

          const expectedPath =
            hierarchyParts.length > 0
              ? `${basePath}/${hierarchyParts.join('/')}`
              : basePath

          console.log(`   Expected path: "${expectedPath}"`)

          const processGroupId = pathToIdMap.get(expectedPath)
          console.log(`   Found process group ID: ${processGroupId || 'NOT FOUND'}`)

          const flowKey = getFlowItemKey(flow.id, flowType)

          if (!processGroupId) {
            newStatuses[flowKey] = {
              status: 'not_deployed',
              instance_id: instanceId,
              process_group_id: '',
              detail: 'not_deployed',
              data: {
                not_deployed: true,
                message: 'Flow not found / Not deployed',
                expected_path: expectedPath,
              },
            }
            return
          }

          try {
            const response = await apiCall<ProcessGroupStatus>(
              `nifi/instances/${instanceId}/ops/process-groups/${processGroupId}/status/canvas?detail=all`,
            )
            newStatuses[flowKey] = response
          } catch (err: unknown) {
            const errMsg = (err as Error).message ?? ''
            newStatuses[flowKey] = {
              status: 'not_deployed',
              instance_id: instanceId,
              process_group_id: '',
              detail: 'not_deployed',
              data: {
                not_deployed: true,
                message: errMsg.includes('404') ? 'Flow not found / Not deployed' : errMsg,
              },
            }
          }
        }

        for (const flow of flows) {
          await checkPart(flow, 'source')
          await checkPart(flow, 'destination')
        }

        console.log('\n✅ [DEBUG] Final flow statuses:', newStatuses)
        console.log(`📊 [DEBUG] Total statuses collected: ${Object.keys(newStatuses).length}`)

        setFlowStatuses(newStatuses)
      } catch (err: unknown) {
        setCheckError((err as Error).message || 'Failed to check flows')
      } finally {
        setChecking(false)
      }
    },
    [apiCall, flows],
  )

  return useMemo(
    () => ({
      flowStatuses,
      checking,
      checkError,
      checkAllFlows,
      getFlowItemStatus,
      healthyCount,
      unhealthyCount,
      unknownCount,
    }),
    [
      flowStatuses,
      checking,
      checkError,
      checkAllFlows,
      getFlowItemStatus,
      healthyCount,
      unhealthyCount,
      unknownCount,
    ],
  )
}
