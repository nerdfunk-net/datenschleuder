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
        console.log('[QuickDeploy] ═══════════════════════════════════════════════════')
        console.log('[QuickDeploy] Starting deployment for flow:', {
          flowId: flow.id,
          flowName: flow.name,
          target,
          hierarchyValues: flow.hierarchy_values,
        })

        // Check if deployment settings are loaded
        if (!deploymentSettings) {
          console.error('[QuickDeploy] ERROR: Deployment settings not loaded')
          toast({
            title: 'Deployment settings not loaded',
            description: 'Please wait for the page to fully load and try again.',
            variant: 'destructive',
          })
          return
        }

        console.log('[QuickDeploy] Deployment settings:', deploymentSettings)

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
        console.log('[QuickDeploy] Deployment config:', config)

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
        const processGroupName = generateProcessGroupName(
          deploymentSettings.global.process_group_name_template,
          config,
          flow,
          hierAttrs
        )

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

        // Check if deployment settings are loaded
        if (!deploymentSettings) {
          toast({
            title: 'Deployment settings not loaded',
            description: 'Please wait for deployment settings to load and try again.',
            variant: 'destructive',
          })
          return
        }

        const instancePaths = deploymentSettings.paths[config.instanceId.toString()]
        console.log('[QuickDeploy] Instance paths for instance', config.instanceId, ':', instancePaths)
        
        const savedPath = target === 'source' ? instancePaths?.source_path : instancePaths?.dest_path
        console.log('[QuickDeploy] Selected', target, 'path:', savedPath)

        if (!savedPath) {
          console.error('[QuickDeploy] ERROR: No saved path found for', target)
          toast({
            title: 'Deployment path not configured',
            description: `No ${target} path is configured for this NiFi instance. Open Settings → Deploy, click "Load Paths" for instance ${config.instanceId}, select the ${target} path, and save.`,
            variant: 'destructive',
          })
          return
        }

        const parentProcessGroupId: string | null = null
        let parentProcessGroupPath: string | null = null

        if (savedPath.raw_path) {
          console.log('[QuickDeploy] ✅ Using raw_path (preferred method)')
          console.log('[QuickDeploy] raw_path value:', savedPath.raw_path)
          console.log('[QuickDeploy] Hierarchy attributes:', hierAttrs)
          
          // ✅ Preferred path: build full nested path using raw_path (e.g. "/From net1")
          // + middle hierarchy attribute values (skip first=DC and last=CN/leaf)
          const baseParts = savedPath.raw_path.split('/').filter(s => s.trim())
          console.log('[QuickDeploy] Base parts after split:', baseParts)
          
          const middleParts: string[] = []
          
          // Loop through middle hierarchy levels (skip first [DC] and last [CN])
          console.log('[QuickDeploy] Extracting middle hierarchy parts...')
          console.log('[QuickDeploy] Hierarchy length:', hierAttrs.length, '(will process indices 1 to', hierAttrs.length - 2, ')')
          
          for (let i = 1; i < hierAttrs.length - 1; i++) {
            const attr = hierAttrs[i]
            console.log(`[QuickDeploy] Processing hierarchy[${i}]:`, attr)
            if (!attr) {
              console.warn(`[QuickDeploy] WARNING: hierarchy[${i}] is undefined/null`)
              continue
            }
            const values = flow.hierarchy_values?.[attr.name]
            console.log(`[QuickDeploy]   - Flow values for ${attr.name}:`, values)
            const value = target === 'source' ? values?.source : values?.destination
            console.log(`[QuickDeploy]   - Selected ${target} value:`, value)
            if (value) {
              middleParts.push(value)
              console.log(`[QuickDeploy]   - ✅ Added "${value}" to middleParts`)
            } else {
              console.log(`[QuickDeploy]   - ⚠️  No value found, skipping`)
            }
          }
          
          // Build full path: base + hierarchy values
          parentProcessGroupPath = [...baseParts, ...middleParts].join('/')
          
          console.log('[QuickDeploy] ═══ PATH CONSTRUCTION RESULT ═══')
          console.log('[QuickDeploy] Base parts:', baseParts)
          console.log('[QuickDeploy] Middle parts:', middleParts)
          console.log('[QuickDeploy] Final path:', parentProcessGroupPath)
          console.log('[QuickDeploy] ════════════════════════════════')
        } else {
          // ❌ CRITICAL: raw_path missing (old settings).
          // This would deploy into the base group without hierarchy nesting.
          // BLOCK deployment and force user to update settings.
          console.error('[QuickDeploy] ❌ CRITICAL: raw_path is missing!')
          console.error('[QuickDeploy] Deployment settings were saved before raw_path field was added.')
          console.error('[QuickDeploy] Without raw_path, the flow would be deployed to the WRONG location.')
          console.error('[QuickDeploy] savedPath:', savedPath)
          
          toast({
            title: 'Deployment settings outdated',
            description: 'Please go to Settings → Deploy, click "Load Paths" for this instance, re-select your paths, and save. This will fix the missing raw_path field.',
            variant: 'destructive',
          })
          
          // STOP deployment - don't proceed with wrong path
          return
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
            deploymentSettings.global.stop_versioning_after_deploy ?? false,
          disable_after_deploy: deploymentSettings.global.disable_after_deploy ?? false,
          start_after_deploy: deploymentSettings.global.start_after_deploy ?? false,
          parameter_context_name:
            (target === 'source' ? flow.src_connection_param : flow.dest_connection_param) ||
            undefined,
        }

        console.log('[QuickDeploy] ═══ FINAL DEPLOYMENT REQUEST ═══')
        console.log('[QuickDeploy] Instance ID:', config.instanceId)
        console.log('[QuickDeploy] Request payload:', JSON.stringify(request, null, 2))
        console.log('[QuickDeploy] ════════════════════════════════')

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
