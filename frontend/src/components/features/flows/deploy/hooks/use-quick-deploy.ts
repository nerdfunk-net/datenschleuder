'use client'

import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useDeployMutations } from './use-deploy-mutations'
import { useDeploymentSettingsQuery } from './use-deploy-query'
import { buildDeploymentConfigs, generateProcessGroupName } from '../utils/deployment-config-utils'
import type { NifiFlow } from '@/components/features/flows/manage/types'
import type { NifiInstance, RegistryFlow, ConflictInfo, DeploymentConfig, DeploymentError, DeploymentRequest } from '../types'

const EMPTY_HIERARCHY: { name: string; label: string; order: number }[] = []

interface CurrentConflict {
  config: DeploymentConfig
  conflictInfo: ConflictInfo
  request: DeploymentRequest
  resolveCallback: (action: 'skip' | 'delete' | 'update') => void
}

export function useQuickDeploy({
  instances,
  registryFlows,
  hierarchyAttributes,
}: {
  instances: NifiInstance[]
  registryFlows: RegistryFlow[]
  hierarchyAttributes: { name: string; label: string; order: number }[]
}) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const { deployFlow, deleteProcessGroup, updateProcessGroupVersion } = useDeployMutations()
  const { data: deploymentSettings } = useDeploymentSettingsQuery()

  const [deployingFlows, setDeployingFlows] = useState<Record<string, boolean>>({})
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [currentConflict, setCurrentConflict] = useState<CurrentConflict | null>(null)
  const [isResolvingConflict, setIsResolvingConflict] = useState(false)

  const hierAttrs = hierarchyAttributes.length > 0 ? hierarchyAttributes : EMPTY_HIERARCHY

  // Internal: deploy with conflict handling
  const deployAndHandle = useCallback(
    async (config: DeploymentConfig, request: DeploymentRequest) => {
      try {
        await deployFlow.mutateAsync({
          instanceId: config.instanceId!,
          request,
        })
        toast({
          title: 'Deployed successfully',
          description: `"${config.flowName}" deployed to ${config.hierarchyValue} (${config.target})`,
        })
      } catch (err: unknown) {
        const error = err as DeploymentError
        if (error?.status === 409 || error?.message?.includes('already exists')) {
          const conflictInfo: ConflictInfo = error.conflictInfo ?? {
            message: 'Process group already exists',
            existing_process_group: {
              id: 'unknown',
              name: config.processGroupName,
              running_count: 0,
              stopped_count: 0,
              has_version_control: false,
            },
          }

          const action = await new Promise<'skip' | 'delete' | 'update'>((resolve) => {
            setCurrentConflict({ config, conflictInfo, request, resolveCallback: resolve })
            setShowConflictDialog(true)
          })

          setShowConflictDialog(false)
          setIsResolvingConflict(true)

          try {
            if (action === 'skip') {
              toast({ title: 'Deployment skipped', description: 'Skipped due to existing process group' })
            } else if (action === 'delete') {
              await deleteProcessGroup.mutateAsync({
                instanceId: config.instanceId!,
                processGroupId: conflictInfo.existing_process_group.id,
              })
              await deployFlow.mutateAsync({
                instanceId: config.instanceId!,
                request,
              })
              toast({
                title: 'Deployed successfully',
                description: `"${config.flowName}" redeployed after removing existing group`,
              })
            } else if (action === 'update') {
              await updateProcessGroupVersion.mutateAsync({
                instanceId: config.instanceId!,
                processGroupId: conflictInfo.existing_process_group.id,
                version: 0,
              })
              toast({ title: 'Version updated', description: `"${config.processGroupName}" version updated` })
            }
          } finally {
            setIsResolvingConflict(false)
            setCurrentConflict(null)
          }
        } else {
          toast({
            title: 'Deployment failed',
            description: (err as Error)?.message || 'Unknown error',
            variant: 'destructive',
          })
        }
      }
    },
    [deployFlow, deleteProcessGroup, updateProcessGroupVersion, toast]
  )

  const quickDeploy = useCallback(
    async (flow: NifiFlow, target: 'source' | 'destination') => {
      const key = `${flow.id}-${target}`
      setDeployingFlows((prev) => ({ ...prev, [key]: true }))

      try {
        // Resolve the deployment config (instance, template, registry info)
        const configs = buildDeploymentConfigs(
          [flow],
          [flow.id],
          { [flow.id]: target },
          instances as unknown as Parameters<typeof buildDeploymentConfigs>[3],
          registryFlows,
          hierAttrs
        )

        const config = configs[0]

        if (!config) {
          toast({
            title: 'Cannot deploy',
            description: 'No matching NiFi instance found for this flow',
            variant: 'destructive',
          })
          return
        }

        if (!config.instanceId) {
          toast({
            title: 'Cannot deploy',
            description: 'No NiFi instance is configured for this hierarchy value',
            variant: 'destructive',
          })
          return
        }

        // Generate process group name from settings template
        const processGroupName = deploymentSettings
          ? generateProcessGroupName(
              deploymentSettings.global.process_group_name_template,
              config,
              flow,
              hierAttrs
            )
          : config.hierarchyValue

        // Get configured process group path from settings (if any)
        const instancePaths = deploymentSettings?.paths[config.instanceId.toString()]
        const processGroupPath =
          target === 'source' ? instancePaths?.source_path : instancePaths?.dest_path

        // If a path is configured, try to resolve it to an ID; otherwise use path directly
        let parentProcessGroupId: string | null = null
        let parentProcessGroupPath: string | null = processGroupPath ?? null

        if (processGroupPath) {
          try {
            const pathsData = await apiCall(
              `nifi/instances/${config.instanceId}/ops/process-groups/all-paths`
            ) as { process_groups?: { id: string; path: string; formatted_path: string }[] }

            const match = pathsData?.process_groups?.find(
              (pg) =>
                pg.path === processGroupPath ||
                pg.formatted_path.includes(processGroupPath) ||
                processGroupPath.includes(pg.path)
            )

            if (match) {
              parentProcessGroupId = match.id
              parentProcessGroupPath = null // Use ID when available
            }
          } catch {
            // Path lookup failed — fall back to path string (backend handles it)
          }
        }

        const request: DeploymentRequest = {
          template_id: config.templateId,
          bucket_id: config.bucketId,
          flow_id: config.flowIdRegistry,
          registry_client_id: config.registryId,
          parent_process_group_id: parentProcessGroupId,
          parent_process_group_path: parentProcessGroupPath,
          process_group_name: processGroupName,
          version: null,
          x_position: 0,
          y_position: 0,
          stop_versioning_after_deploy:
            deploymentSettings?.global.stop_versioning_after_deploy ?? false,
          disable_after_deploy: deploymentSettings?.global.disable_after_deploy ?? false,
          start_after_deploy: deploymentSettings?.global.start_after_deploy ?? false,
          parameter_context_name:
            (target === 'source' ? flow.src_connection_param : flow.dest_connection_param) ||
            undefined,
        }

        await deployAndHandle({ ...config, processGroupName }, request)
      } finally {
        setDeployingFlows((prev) => ({ ...prev, [key]: false }))
      }
    },
    [instances, registryFlows, hierAttrs, deploymentSettings, deployAndHandle, apiCall, toast]
  )

  const handleSkipConflict = useCallback(() => {
    currentConflict?.resolveCallback('skip')
  }, [currentConflict])

  const handleDeleteConflict = useCallback(() => {
    currentConflict?.resolveCallback('delete')
  }, [currentConflict])

  const handleUpdateConflict = useCallback(() => {
    currentConflict?.resolveCallback('update')
  }, [currentConflict])

  return {
    quickDeploy,
    deployingFlows,
    showConflictDialog,
    setShowConflictDialog,
    currentConflict,
    isResolvingConflict,
    handleSkipConflict,
    handleDeleteConflict,
    handleUpdateConflict,
  }
}
