'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2, Rocket } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { useApi } from '@/hooks/use-api'
import { useFlowsQuery } from '@/components/features/flows/manage/hooks/use-flows-query'
import { useNifiInstancesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'
import { useRegistryFlowsQuery, useDeploymentSettingsQuery } from './hooks/use-deploy-query'
import { Step1SelectFlows } from './components/step-1-select-flows'
import { Step2ChooseTargets } from './components/step-2-choose-targets'
import { Step3ProcessGroups } from './components/step-3-process-groups'
import { Step4Settings } from './components/step-4-settings'
import { Step5Review } from './components/step-5-review'
import { ConflictResolutionDialog } from './dialogs/conflict-resolution-dialog'
import { DeploymentResultsDialog } from './dialogs/deployment-results-dialog'
import { STEPS, type DeploymentConfig, type NifiInstance, type RegistryFlow, type ProcessGroupPath, type FlowVersion, type ConflictInfo, type DeploymentError, type DeploymentResponse, type DeploymentResults, type DeploymentSettings } from './types'
import { useDeployMutations } from './hooks/use-deploy-mutations'
import { sortDeploymentConfigs } from './utils/deployment-config-utils'
import type { NifiFlow } from '@/components/features/flows/manage/types'
import {
  buildDeploymentConfigs,
  autoSelectProcessGroup,
  generateProcessGroupName,
  getSuggestedPath,
} from './utils/deployment-config-utils'

// Empty arrays outside component (React best practice)
const EMPTY_FLOWS: NifiFlow[] = []
const EMPTY_FLOW_IDS: number[] = []
const EMPTY_TARGETS: Record<number, 'source' | 'destination' | 'both'> = {}
const EMPTY_CONFIGS: DeploymentConfig[] = []
const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_HIERARCHY: { name: string; label: string; order: number }[] = []
const EMPTY_REGISTRY_FLOWS: RegistryFlow[] = []

export function DeploymentWizard() {
  const { apiCall } = useApi()
  const router = useRouter()

  // Current step (0-4)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Step 1: Selected flows
  const [selectedFlowIds, setSelectedFlowIds] = useState<number[]>(EMPTY_FLOW_IDS)

  // Step 2: Deployment targets
  const [deploymentTargets, setDeploymentTargets] = useState<
    Record<number, 'source' | 'destination' | 'both'>
  >(EMPTY_TARGETS)

  // Step 3: Deployment configs
  const [deploymentConfigs, setDeploymentConfigs] = useState<DeploymentConfig[]>(EMPTY_CONFIGS)
  const [isLoadingPaths, setIsLoadingPaths] = useState(false)

  // Step 4: Version loading and settings
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)

  // Step 5: Deployment execution
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentResults, setDeploymentResults] = useState<DeploymentResults | null>(null)
  const [showResultsDialog, setShowResultsDialog] = useState(false)

  // Conflict resolution
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [currentConflict, setCurrentConflict] = useState<{
    config: DeploymentConfig
    conflictInfo: ConflictInfo
    resolveCallback: (action: 'skip' | 'delete' | 'update') => void
  } | null>(null)
  const [isResolvingConflict, setIsResolvingConflict] = useState(false)

  // Mutation hooks
  const { deployFlow, deleteProcessGroup, updateProcessGroupVersion, saveSettings } = useDeployMutations()

  // Fetch required data
  const { data: flows = EMPTY_FLOWS, isLoading: isLoadingFlows, error: flowsError } = useFlowsQuery()
  const { data: instances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const { data: registryFlows = EMPTY_REGISTRY_FLOWS } = useRegistryFlowsQuery()
  const { data: deploymentSettings } = useDeploymentSettingsQuery()

  // Local state for settings (allows immediate checkbox updates)
  const [localSettings, setLocalSettings] = useState<DeploymentSettings | undefined>(undefined)

  // Use local settings if available, otherwise fall back to query data
  const effectiveSettings = localSettings || deploymentSettings

  // Sync local settings when query data changes
  useEffect(() => {
    if (deploymentSettings && !localSettings) {
      setLocalSettings(deploymentSettings)
    }
  }, [deploymentSettings, localSettings])

  const { data: hierarchyData } = useQuery({
    queryKey: queryKeys.nifi.hierarchy(),
    queryFn: async () => apiCall('nifi/hierarchy') as Promise<{ hierarchy?: { name: string; label: string; order: number }[] }>,
  })

  const hierarchyAttributes = useMemo(
    () => hierarchyData?.hierarchy || EMPTY_HIERARCHY,
    [hierarchyData]
  )

  const currentStep = useMemo(() => STEPS[currentStepIndex] ?? STEPS[0], [currentStepIndex])

  // Navigation handlers
  const goToNextStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1))
  }, [])

  const goToPreviousStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const goToStep = useCallback((stepIndex: number) => {
    setCurrentStepIndex(Math.max(0, Math.min(stepIndex, STEPS.length - 1)))
  }, [])

  // Step 1: Flow selection handlers
  const handleToggleFlow = useCallback((flowId: number) => {
    setSelectedFlowIds((prev) => {
      if (prev.includes(flowId)) {
        return prev.filter((id) => id !== flowId)
      }
      return [...prev, flowId]
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    if (selectedFlowIds.length === flows.length && flows.length > 0) {
      setSelectedFlowIds(EMPTY_FLOW_IDS)
    } else {
      setSelectedFlowIds(flows.map((flow: NifiFlow) => flow.id))
    }
  }, [flows, selectedFlowIds.length])

  // Step 2: Target selection handler
  const handleSetTarget = useCallback((flowId: number, target: 'source' | 'destination' | 'both') => {
    setDeploymentTargets((prev) => ({
      ...prev,
      [flowId]: target,
    }))
  }, [])

  // Step 3: Build deployment configs when entering step 3
  useEffect(() => {
    if (currentStepIndex === 2 && deploymentConfigs.length === 0) {
      console.log('[DeploymentWizard] Building deployment configs')
      console.log('[DeploymentWizard] Instances available:', instances.length, instances)
      console.log('[DeploymentWizard] Hierarchy attributes:', hierarchyAttributes)
      console.log('[DeploymentWizard] Selected flows:', selectedFlowIds)
      console.log('[DeploymentWizard] Deployment targets:', deploymentTargets)

      const configs = buildDeploymentConfigs(
        flows,
        selectedFlowIds,
        deploymentTargets,
        instances as unknown as NifiInstance[],
        registryFlows,
        hierarchyAttributes
      )
      console.log('[DeploymentWizard] Built configs:', configs.length, configs)
      setDeploymentConfigs(configs)
    }
  }, [currentStepIndex, deploymentConfigs.length, flows, selectedFlowIds, deploymentTargets, instances, registryFlows, hierarchyAttributes])

  // Step 3: Load process group paths for each config
  useEffect(() => {
    if (currentStepIndex !== 2 || deploymentConfigs.length === 0) return

    const configsNeedingPaths = deploymentConfigs.filter(
      (c) => c.instanceId !== null && c.availablePaths.length === 0
    )
    if (configsNeedingPaths.length === 0) return

    {
      const loadPaths = async () => {
        setIsLoadingPaths(true)
        console.log('[DeploymentWizard] Loading process group paths')

        const uniqueInstanceIds = Array.from(
          new Set(deploymentConfigs.map((c) => c.instanceId).filter((id): id is number => id !== null))
        )

        const pathsCache: Record<string, ProcessGroupPath[]> = {}

        for (const instanceId of uniqueInstanceIds) {
          try {
            const data = await apiCall(`nifi/instances/${instanceId}/ops/process-groups/all-paths`) as { process_groups?: ProcessGroupPath[] }

            if (data?.process_groups) {
              pathsCache[instanceId.toString()] = data.process_groups
            } else {
              console.warn(`[DeploymentWizard] No process groups returned - using root as default`)
              pathsCache[instanceId.toString()] = [
                {
                  id: 'root',
                  name: 'NiFi Flow',
                  path: '/',
                  level: 0,
                  formatted_path: 'NiFi Flow (root)',
                }
              ]
            }
          } catch (error) {
            console.error(`Failed to load paths for instance ${instanceId}:`, error)
            pathsCache[instanceId.toString()] = [
              {
                id: 'root',
                name: 'NiFi Flow',
                path: '/',
                level: 0,
                formatted_path: 'NiFi Flow (root)',
              }
            ]
          }
        }

        setDeploymentConfigs((prevConfigs) =>
          prevConfigs.map((config) => {
            if (!config.instanceId) return config

            const paths = pathsCache[config.instanceId.toString()] || []
            const suggestedPath = effectiveSettings ? getSuggestedPath(config, effectiveSettings) : null
            const autoSelectedId = effectiveSettings
              ? autoSelectProcessGroup(config, effectiveSettings, hierarchyAttributes)
              : null

            const selectedFlow = flows.find((f) => f.id === config.flowId)
            const processGroupName = effectiveSettings && selectedFlow
              ? generateProcessGroupName(
                  effectiveSettings.global.process_group_name_template,
                  config,
                  selectedFlow,
                  hierarchyAttributes
                )
              : config.hierarchyValue

            return {
              ...config,
              availablePaths: paths,
              suggestedPath,
              selectedProcessGroupId: autoSelectedId || config.selectedProcessGroupId,
              processGroupName,
            }
          })
        )

        setIsLoadingPaths(false)
        console.log('[DeploymentWizard] Finished loading paths')
      }

      loadPaths()
    }
  }, [currentStepIndex, deploymentConfigs, effectiveSettings, hierarchyAttributes, flows, apiCall])

  // Step 3: Update process group selection
  const handleUpdateProcessGroup = useCallback((configKey: string, processGroupId: string) => {
    setDeploymentConfigs((prev) =>
      prev.map((config) =>
        config.key === configKey
          ? { ...config, selectedProcessGroupId: processGroupId }
          : config
      )
    )
  }, [])

  // Step 4: Load versions when entering step 4
  useEffect(() => {
    if (currentStepIndex !== 3 || deploymentConfigs.length === 0) return

    const configsNeedingVersions = deploymentConfigs.filter(
      (c) => c.instanceId && c.registryId && c.bucketId && c.flowIdRegistry && c.availableVersions.length === 0
    )
    if (configsNeedingVersions.length === 0) return

    {
      const loadVersions = async () => {
        setIsLoadingVersions(true)
        console.log('[DeploymentWizard] Loading flow versions')

        const updatedConfigs = await Promise.all(
          deploymentConfigs.map(async (config) => {
            if (config.instanceId && config.registryId && config.bucketId && config.flowIdRegistry) {
              try {
                console.log(
                  `[DeploymentWizard] Loading versions for ${config.flowName} (${config.target}): instance=${config.instanceId}, registry=${config.registryId}, bucket=${config.bucketId}, flow=${config.flowIdRegistry}`
                )
                const data = await apiCall(
                  `nifi/instances/${config.instanceId}/ops/registries/${config.registryId}/buckets/${config.bucketId}/flows/${config.flowIdRegistry}/versions`
                ) as { versions?: FlowVersion[] }
                console.log(`[DeploymentWizard] Loaded ${data.versions?.length || 0} versions for ${config.flowName}`)
                return { ...config, availableVersions: data.versions || [] }
              } catch (error) {
                console.error(`Failed to load versions for ${config.flowName} (${config.target}):`, error)
              }
            } else {
              console.warn(
                `[DeploymentWizard] Missing registry info for ${config.flowName} (${config.target}): instanceId=${config.instanceId}, registryId=${config.registryId}, bucketId=${config.bucketId}, flowIdRegistry=${config.flowIdRegistry}`
              )
            }
            return config
          })
        )

        setDeploymentConfigs(updatedConfigs)
        setIsLoadingVersions(false)
        console.log('[DeploymentWizard] Finished loading versions')
      }

      loadVersions()
    }
  }, [currentStepIndex, deploymentConfigs, apiCall])

  // Step 4: Update version selection
  const handleUpdateVersion = useCallback((configKey: string, version: number | null) => {
    setDeploymentConfigs((prev) =>
      prev.map((config) =>
        config.key === configKey ? { ...config, selectedVersion: version } : config
      )
    )
  }, [])

  // Step 4: Update deployment settings
  const handleUpdateSettings = useCallback((updatedSettings: DeploymentSettings) => {
    console.log('[DeploymentWizard] Settings updated:', updatedSettings)
    setLocalSettings(updatedSettings)
    saveSettings.mutate(updatedSettings)
  }, [saveSettings])

  // Step 5: Deploy all flows
  const handleDeploy = useCallback(async () => {
    setIsDeploying(true)
    console.log('[DeploymentWizard] Starting deployment')

    const sortedConfigs = sortDeploymentConfigs(deploymentConfigs)
    const results: DeploymentResults = {
      total: sortedConfigs.length,
      successCount: 0,
      failureCount: 0,
      successful: [],
      failed: [],
    }

    for (const config of sortedConfigs) {
      if (!config.instanceId || !config.selectedProcessGroupId) {
        results.failed.push({
          config,
          success: false,
          error: 'Missing instance or process group',
        })
        results.failureCount++
        continue
      }

      try {
        console.log(`[DeploymentWizard] Deploying ${config.flowName} to ${config.hierarchyValue}`)

        const deploymentRequest = {
          template_id: config.templateId,
          bucket_id: config.bucketId,
          flow_id: config.flowIdRegistry,
          registry_client_id: config.registryId,
          parent_process_group_id: config.selectedProcessGroupId,
          process_group_name: config.processGroupName,
          version: config.selectedVersion ?? null,
          parameter_context_name: config.parameterContextName || undefined,
          x_position: 0,
          y_position: 0,
          stop_versioning_after_deploy: effectiveSettings?.global.stop_versioning_after_deploy || false,
          disable_after_deploy: effectiveSettings?.global.disable_after_deploy || false,
          start_after_deploy: effectiveSettings?.global.start_after_deploy || false,
        }

        await new Promise((resolve, reject) => {
          deployFlow.mutate({ instanceId: config.instanceId!, request: deploymentRequest }, {
            onSuccess: (response) => {
              console.log(`[DeploymentWizard] Successfully deployed ${config.flowName}`)
              results.successful.push({
                config,
                success: true,
                response,
              })
              results.successCount++
              resolve(response)
            },
            onError: async (error: DeploymentError) => {
              console.error(`[DeploymentWizard] Failed to deploy ${config.flowName}:`, error)

              if (error.status === 409 || error.message?.includes('already exists')) {
                const conflictInfo: ConflictInfo = error.conflictInfo || {
                  message: 'Process group already exists',
                  existing_process_group: {
                    id: 'unknown',
                    name: config.processGroupName,
                    running_count: 0,
                    stopped_count: 0,
                    has_version_control: false,
                  },
                }

                const action = await new Promise<'skip' | 'delete' | 'update'>((resolveAction) => {
                  setCurrentConflict({
                    config,
                    conflictInfo,
                    resolveCallback: resolveAction,
                  })
                  setShowConflictDialog(true)
                })

                setShowConflictDialog(false)
                setIsResolvingConflict(true)

                if (action === 'skip') {
                  results.failed.push({
                    config,
                    success: false,
                    error: 'Deployment skipped due to conflict',
                  })
                  results.failureCount++
                } else if (action === 'delete') {
                  try {
                    await deleteProcessGroup.mutateAsync({
                      instanceId: config.instanceId!,
                      processGroupId: conflictInfo.existing_process_group.id,
                    })
                    const response = await deployFlow.mutateAsync({
                      instanceId: config.instanceId!,
                      request: deploymentRequest,
                    })
                    results.successful.push({
                      config,
                      success: true,
                      response,
                    })
                    results.successCount++
                  } catch (retryError: unknown) {
                    results.failed.push({
                      config,
                      success: false,
                      error: retryError instanceof Error ? retryError.message : 'Failed to delete and redeploy',
                    })
                    results.failureCount++
                  }
                } else if (action === 'update') {
                  try {
                    const response = await updateProcessGroupVersion.mutateAsync({
                      instanceId: config.instanceId!,
                      processGroupId: conflictInfo.existing_process_group.id,
                      version: config.selectedVersion ?? 0,
                    }) as DeploymentResponse
                    results.successful.push({
                      config,
                      success: true,
                      response,
                    })
                    results.successCount++
                  } catch (updateError: unknown) {
                    results.failed.push({
                      config,
                      success: false,
                      error: updateError instanceof Error ? updateError.message : 'Failed to update version',
                    })
                    results.failureCount++
                  }
                }

                setIsResolvingConflict(false)
                setCurrentConflict(null)
                resolve(undefined)
              } else {
                results.failed.push({
                  config,
                  success: false,
                  error: error.message || 'Deployment failed',
                })
                results.failureCount++
                reject(error)
              }
            },
          })
        })
      } catch (error: unknown) {
        console.error(`[DeploymentWizard] Unhandled error deploying ${config.flowName}:`, error)
      }
    }

    console.log('[DeploymentWizard] Deployment complete:', results)
    setDeploymentResults(results)
    setShowResultsDialog(true)
    setIsDeploying(false)
  }, [deploymentConfigs, effectiveSettings, deployFlow, deleteProcessGroup, updateProcessGroupVersion])

  // Conflict resolution handlers
  const handleSkipConflict = useCallback(() => {
    if (currentConflict) {
      currentConflict.resolveCallback('skip')
    }
  }, [currentConflict])

  const handleDeleteConflict = useCallback(() => {
    if (currentConflict) {
      currentConflict.resolveCallback('delete')
    }
  }, [currentConflict])

  const handleUpdateConflict = useCallback(() => {
    if (currentConflict) {
      currentConflict.resolveCallback('update')
    }
  }, [currentConflict])

  const handleCloseResults = useCallback(() => {
    setShowResultsDialog(false)
  }, [])

  const canProceed = useMemo(() => {
    switch (currentStepIndex) {
      case 0: return selectedFlowIds.length > 0
      case 1: return selectedFlowIds.every((flowId) => deploymentTargets[flowId])
      case 2: return deploymentConfigs.every((config) => config.selectedProcessGroupId && config.instanceId)
      case 3: return true
      case 4: return deploymentConfigs.length > 0 && !isDeploying
      default: return false
    }
  }, [currentStepIndex, selectedFlowIds, deploymentTargets, deploymentConfigs, isDeploying])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Rocket className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Deploy Flows</h1>
            <p className="text-muted-foreground mt-2">
              Deploy NiFi flows to source and/or destination instances
            </p>
          </div>
        </div>
      </div>

      {/* Step Tab Indicators */}
      <div className="grid grid-cols-5 gap-2">
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            onClick={() => index <= currentStepIndex && goToStep(index)}
            disabled={index > currentStepIndex}
            className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
              index === currentStepIndex
                ? 'border-blue-500 bg-white shadow-sm'
                : index < currentStepIndex
                  ? 'border-transparent bg-green-50 hover:bg-green-100 cursor-pointer'
                  : 'border-transparent bg-slate-100 cursor-not-allowed opacity-70'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                index === currentStepIndex
                  ? 'bg-blue-600 text-white'
                  : index < currentStepIndex
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-300 text-slate-500'
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`text-sm font-medium leading-tight ${
                index === currentStepIndex
                  ? 'text-slate-900'
                  : index < currentStepIndex
                    ? 'text-green-800'
                    : 'text-slate-500'
              }`}
            >
              {step.title}
            </span>
          </button>
        ))}
      </div>

      {/* Step Content Panel */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        {/* Gradient header showing current step */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">
              Step {currentStepIndex + 1}: {currentStep.contentTitle}
            </span>
          </div>
          <div className="text-xs text-blue-100 hidden sm:block">
            {currentStep.description}
          </div>
        </div>

        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {currentStepIndex === 0 && (
            <Step1SelectFlows
              flows={flows}
              selectedFlowIds={selectedFlowIds}
              onToggleFlow={handleToggleFlow}
              onToggleSelectAll={handleToggleSelectAll}
              isLoading={isLoadingFlows}
              error={flowsError}
            />
          )}

          {currentStepIndex === 1 && (
            <Step2ChooseTargets
              flows={flows}
              selectedFlowIds={selectedFlowIds}
              deploymentTargets={deploymentTargets}
              onSetTarget={handleSetTarget}
            />
          )}

          {currentStepIndex === 2 && (
            <Step3ProcessGroups
              deploymentConfigs={deploymentConfigs}
              onUpdateProcessGroup={handleUpdateProcessGroup}
              isLoadingPaths={isLoadingPaths}
            />
          )}

          {currentStepIndex === 3 && (
            <Step4Settings
              deploymentConfigs={deploymentConfigs}
              deploymentSettings={effectiveSettings}
              onUpdateVersion={handleUpdateVersion}
              onUpdateSettings={handleUpdateSettings}
              isLoadingVersions={isLoadingVersions}
            />
          )}

          {currentStepIndex === 4 && (
            <Step5Review
              deploymentConfigs={deploymentConfigs}
              deploymentSettings={effectiveSettings}
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {currentStepIndex === 0 ? (
          <Button variant="outline" onClick={() => router.push('/flows/manage')}>
            Cancel
          </Button>
        ) : (
          <Button variant="outline" onClick={goToPreviousStep}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        )}

        {currentStepIndex < STEPS.length - 1 ? (
          <Button onClick={goToNextStep} disabled={!canProceed}>
            Next: {STEPS[currentStepIndex + 1]?.contentTitle}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleDeploy} disabled={!canProceed || isDeploying}>
            {isDeploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              'Deploy All'
            )}
          </Button>
        )}
      </div>

      {/* Conflict Resolution Dialog */}
      <ConflictResolutionDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflictInfo={currentConflict?.conflictInfo || null}
        deploymentConfig={currentConflict?.config || null}
        onSkip={handleSkipConflict}
        onDelete={handleDeleteConflict}
        onUpdateVersion={handleUpdateConflict}
        isResolving={isResolvingConflict}
      />

      {/* Deployment Results Dialog */}
      {deploymentResults && (
        <DeploymentResultsDialog
          open={showResultsDialog}
          onOpenChange={setShowResultsDialog}
          results={deploymentResults}
          onClose={handleCloseResults}
        />
      )}
    </div>
  )
}
