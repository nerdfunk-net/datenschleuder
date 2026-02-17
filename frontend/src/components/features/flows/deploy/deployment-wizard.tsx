'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
import { STEPS, type DeploymentConfig, type NifiInstance, type ConflictInfo, type DeploymentResults, type DeploymentSettings } from './types'
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

export function DeploymentWizard() {
  const { apiCall } = useApi()
  
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
  const { data: registryFlows = [] } = useRegistryFlowsQuery()
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
    queryFn: async () => apiCall('nifi/hierarchy'),
  })

  // Get hierarchy from API
  const hierarchyAttributes = useMemo(
    () => hierarchyData?.hierarchy || EMPTY_HIERARCHY,
    [hierarchyData]
  )

  // Current step info
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
        instances,
        registryFlows,
        hierarchyAttributes
      )
      console.log('[DeploymentWizard] Built configs:', configs.length, configs)
      setDeploymentConfigs(configs)
    }
  }, [currentStepIndex, deploymentConfigs.length, flows, selectedFlowIds, deploymentTargets, instances, registryFlows, hierarchyAttributes])

  // Step 3: Load process group paths for each config
  useEffect(() => {
    if (currentStepIndex === 2 && deploymentConfigs.length > 0) {
      const loadPaths = async () => {
        setIsLoadingPaths(true)
        console.log('[DeploymentWizard] Loading process group paths')

        // Load paths for each unique instance
        const uniqueInstanceIds = Array.from(
          new Set(deploymentConfigs.map((c) => c.instanceId).filter((id): id is number => id !== null))
        )

        const pathsCache: Record<string, any[]> = {}

        for (const instanceId of uniqueInstanceIds) {
          try {
            const data = await apiCall(`nifi/instances/${instanceId}/ops/process-groups/all-paths`)
            
            if (data?.process_groups) {
              pathsCache[instanceId.toString()] = data.process_groups
            } else {
              console.warn(`[DeploymentWizard] No process groups returned - using root as default`)
              // Fallback: use root process group
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
            // Fallback: use root process group
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

        // Update configs with paths and auto-select
        setDeploymentConfigs((prevConfigs) =>
          prevConfigs.map((config) => {
            if (!config.instanceId) return config

            const paths = pathsCache[config.instanceId.toString()] || []
            const suggestedPath = effectiveSettings ? getSuggestedPath(config, effectiveSettings) : null
            const autoSelectedId = effectiveSettings
              ? autoSelectProcessGroup(config, effectiveSettings, hierarchyAttributes)
              : null

            // Generate process group name
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
  }, [currentStepIndex, deploymentConfigs.length, effectiveSettings, hierarchyAttributes, flows, apiCall])

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
    if (currentStepIndex === 3 && deploymentConfigs.length > 0) {
      const loadVersions = async () => {
        setIsLoadingVersions(true)
        console.log('[DeploymentWizard] Loading flow versions')

        // Load versions for each config with registryId/bucketId/flowIdRegistry
        const updatedConfigs = await Promise.all(
          deploymentConfigs.map(async (config) => {
            // Need instance, registry, bucket, and flow info to fetch versions
            if (config.instanceId && config.registryId && config.bucketId && config.flowIdRegistry) {
              try {
                console.log(
                  `[DeploymentWizard] Loading versions for ${config.flowName} (${config.target}): instance=${config.instanceId}, registry=${config.registryId}, bucket=${config.bucketId}, flow=${config.flowIdRegistry}`
                )
                const data = await apiCall(
                  `nifi/instances/${config.instanceId}/ops/registries/${config.registryId}/buckets/${config.bucketId}/flows/${config.flowIdRegistry}/versions`
                )
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
  }, [currentStepIndex, deploymentConfigs.length, apiCall])

  // Step 4: Update version selection
  const handleUpdateVersion = useCallback((configKey: string, version: string | null) => {
    setDeploymentConfigs((prev) =>
      prev.map((config) =>
        config.key === configKey ? { ...config, selectedVersion: version } : config
      )
    )
  }, [])

  // Step 4: Update deployment settings
  const handleUpdateSettings = useCallback((updatedSettings: DeploymentSettings) => {
    console.log('[DeploymentWizard] Settings updated:', updatedSettings)
    // Update local state immediately for responsive UI
    setLocalSettings(updatedSettings)
    // Save to backend
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
          version: config.selectedVersion || undefined,
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
            onError: async (error: any) => {
              console.error(`[DeploymentWizard] Failed to deploy ${config.flowName}:`, error)

              // Check for 409 conflict
              if (error.status === 409 || error.message?.includes('already exists')) {
                // Show conflict dialog and wait for resolution
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
                    // Retry deployment
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
                  } catch (retryError: any) {
                    results.failed.push({
                      config,
                      success: false,
                      error: retryError.message || 'Failed to delete and redeploy',
                    })
                    results.failureCount++
                  }
                } else if (action === 'update') {
                  try {
                    const response = await updateProcessGroupVersion.mutateAsync({
                      instanceId: config.instanceId!,
                      processGroupId: conflictInfo.existing_process_group.id,
                      version: config.selectedVersion || undefined,
                    })
                    results.successful.push({
                      config,
                      success: true,
                      response,
                    })
                    results.successCount++
                  } catch (updateError: any) {
                    results.failed.push({
                      config,
                      success: false,
                      error: updateError.message || 'Failed to update version',
                    })
                    results.failureCount++
                  }
                }

                setIsResolvingConflict(false)
                setCurrentConflict(null)
                resolve(undefined)
              } else {
                // Non-conflict error
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
      } catch (error: any) {
        // Catch-all for any unhandled errors
        console.error(`[DeploymentWizard] Unhandled error deploying ${config.flowName}:`, error)
      }
    }

    console.log('[DeploymentWizard] Deployment complete:', results)
    setDeploymentResults(results)
    setShowResultsDialog(true)
    setIsDeploying(false)
  }, [deploymentConfigs, deploymentSettings, deployFlow, deleteProcessGroup, updateProcessGroupVersion])

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

  // Results dialog close handler
  const handleCloseResults = useCallback(() => {
    setShowResultsDialog(false)
    // Optionally reset wizard or navigate away
  }, [])

  // Check if current step is valid to proceed
  const canProceed = useMemo(() => {
    switch (currentStepIndex) {
      case 0: // Step 1: Must select at least one flow
        return selectedFlowIds.length > 0
      case 1: // Step 2: All selected flows must have targets
        return selectedFlowIds.every((flowId) => deploymentTargets[flowId])
      case 2: // Step 3: All configs must have process groups selected
        return deploymentConfigs.every((config) => config.selectedProcessGroupId && config.instanceId)
      case 3: // Step 4: Settings are optional
        return true
      case 4: // Step 5: Ready to deploy
        return deploymentConfigs.length > 0 && !isDeploying
      default:
        return false
    }
  }, [currentStepIndex, selectedFlowIds, deploymentTargets, deploymentConfigs])

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => goToStep(index)}
              disabled={index > currentStepIndex}
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                index === currentStepIndex
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : index < currentStepIndex
                    ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                    : 'border-slate-300 bg-white text-slate-400'
              } ${index <= currentStepIndex ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              {index < currentStepIndex ? '✓' : index + 1}
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-12 ${
                  index < currentStepIndex ? 'bg-green-600' : 'bg-slate-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep.title}
            <span className="ml-2 text-sm font-normal text-slate-500">
              (Step {currentStepIndex + 1} of {STEPS.length})
            </span>
          </CardTitle>
          <CardDescription>{currentStep.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Select Flows */}
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

          {/* Step 2: Choose Targets */}
          {currentStepIndex === 1 && (
            <Step2ChooseTargets
              flows={flows}
              selectedFlowIds={selectedFlowIds}
              deploymentTargets={deploymentTargets}
              onSetTarget={handleSetTarget}
            />
          )}

          {/* Step 3: Process Groups */}
          {currentStepIndex === 2 && (
            <Step3ProcessGroups
              deploymentConfigs={deploymentConfigs}
              onUpdateProcessGroup={handleUpdateProcessGroup}
              isLoadingPaths={isLoadingPaths}
            />
          )}

          {/* Step 4: Settings */}
          {currentStepIndex === 3 && (
            <Step4Settings
              deploymentConfigs={deploymentConfigs}
              deploymentSettings={effectiveSettings}
              onUpdateVersion={handleUpdateVersion}
              onUpdateSettings={handleUpdateSettings}
              isLoadingVersions={isLoadingVersions}
            />
          )}

          {/* Step 5: Review & Deploy */}
          {currentStepIndex === 4 && (
            <Step5Review
              deploymentConfigs={deploymentConfigs}
              deploymentSettings={effectiveSettings}
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="text-sm text-slate-500">
          {selectedFlowIds.length > 0 && currentStepIndex === 0 && (
            <span>{selectedFlowIds.length} flows selected</span>
          )}
        </div>

        {currentStepIndex < STEPS.length - 1 ? (
          <Button onClick={goToNextStep} disabled={!canProceed}>
            Next
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
