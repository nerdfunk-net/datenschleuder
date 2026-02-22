'use client'

import { useState, useCallback } from 'react'
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

        // ─── DEPLOYMENT PATH LOGIC ────────────────────────────────────────────────
        // DO NOT REMOVE OR SIMPLIFY THIS BLOCK.
        //
        // The backend's find_or_create_process_group_by_path() requires a FULL path
        // including all intermediate hierarchy levels, e.g. "From net1/O1/OU1".
        //
        // PathConfig saved in deployment settings contains:
        //   - id:       UUID of the base process group (e.g. the "From net1" UUID)
        //   - raw_path: Raw API path string, e.g. "/From net1"  ← use for path building
        //   - path:     Formatted display label, e.g. "NiFi Flow → From net1"  ← display only
        //
        // We build the full path by combining:
        //   raw_path base parts  +  middle hierarchy values (skip first=DC and last=CN)
        //   e.g. "/From net1" + O=O1 + OU=OU1  →  parent_process_group_path = "From net1/O1/OU1"
        //
        // FALLBACK: If raw_path is absent (settings saved before this field was added),
        //   send the UUID directly as parent_process_group_id instead. The hierarchy
        //   nesting will be wrong (deploys into base group, not OU), but does not crash.
        // ─────────────────────────────────────────────────────────────────────────

        const instancePaths = deploymentSettings?.paths[config.instanceId.toString()]
        const savedPath = target === 'source' ? instancePaths?.source_path : instancePaths?.dest_path

        if (!savedPath) {
          toast({
            title: 'Deployment path not configured',
            description: `No ${target} path is configured for this NiFi instance. Open Settings → Deploy, click "Load Paths" for instance ${config.instanceId}, select the ${target} path, and save.`,
            variant: 'destructive',
          })
          return
        }

        let parentProcessGroupId: string | null = null
        let parentProcessGroupPath: string | null = null

        if (savedPath.raw_path) {
          // ✅ Preferred path: build full nested path using raw_path (e.g. "/From net1")
          // + middle hierarchy attribute values (skip first=DC and last=CN/leaf)
          const baseParts = savedPath.raw_path.split('/').filter(s => s.trim())
          const middleParts: string[] = []
          for (let i = 1; i < hierAttrs.length - 1; i++) {
            const attr = hierAttrs[i]
            if (!attr) continue
            const values = flow.hierarchy_values?.[attr.name]
            const value = target === 'source' ? values?.source : values?.destination
            if (value) middleParts.push(value)
          }
          parentProcessGroupPath = [...baseParts, ...middleParts].join('/')
        } else {
          // ⚠️ Fallback: raw_path missing (old settings). Use the UUID directly.
          // This deploys into the base group without hierarchy nesting.
          // Re-save settings in Settings → Deploy to fix this.
          parentProcessGroupId = savedPath.id
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
    [instances, registryFlows, hierAttrs, deploymentSettings, deployAndHandle, toast]
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
