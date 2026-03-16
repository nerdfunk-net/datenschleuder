'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Server,
  Network,
  Shield,
  Settings,
  Rocket,
  CheckCircle2,
  XCircle,
  Loader2,
  Crown,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useWizardStore } from '../wizard-store'
import { useWizardDeploy } from '../hooks/use-wizard-deploy'
import { useNifiServersQuery } from '../../hooks/use-nifi-servers-query'
import { useNifiInstancesQuery } from '../../hooks/use-nifi-instances-query'
import { useNifiClustersQuery } from '../../hooks/use-nifi-clusters-query'
import type { NifiServer, NifiInstance, NifiCluster } from '../../types'

const EMPTY_SERVERS: NifiServer[] = []
const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_CLUSTERS: NifiCluster[] = []

export function StepReview() {
  const router = useRouter()
  const servers = useWizardStore((s) => s.servers)
  const instances = useWizardStore((s) => s.instances)
  const clusterConfig = useWizardStore((s) => s.clusterConfig)
  const certificates = useWizardStore((s) => s.certificates)
  const adminCertSubject = useWizardStore((s) => s.adminCertSubject)
  const bootstrapConfig = useWizardStore((s) => s.bootstrapConfig)
  const zookeeperConfig = useWizardStore((s) => s.zookeeperConfig)
  const deployStatus = useWizardStore((s) => s.deployStatus)
  const deployProgress = useWizardStore((s) => s.deployProgress)
  const reset = useWizardStore((s) => s.reset)

  const { deploy } = useWizardDeploy()

  // Pre-flight: detect all conflicts (servers, instances, cluster) before deploying
  const { data: existingServers = EMPTY_SERVERS } = useNifiServersQuery()
  const { data: existingInstances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const { data: existingClusters = EMPTY_CLUSTERS } = useNifiClustersQuery()

  const conflictingServers = useMemo(
    () =>
      servers
        .filter((s) => !s.isExisting)
        .filter((s) => existingServers.some((e) => e.server_id === s.server_id)),
    [servers, existingServers]
  )

  const conflictingInstances = useMemo(
    () =>
      instances.filter((inst) =>
        existingInstances.some((e) => e.nifi_url === inst.nifi_url.replace(/\/+$/, ''))
      ),
    [instances, existingInstances]
  )

  const clusterConflict = useMemo(
    () => existingClusters.find((c) => c.cluster_id === clusterConfig.cluster_id) ?? null,
    [existingClusters, clusterConfig.cluster_id]
  )

  const hasConflicts = conflictingServers.length > 0 || conflictingInstances.length > 0 || clusterConflict !== null

  const [showConflictDialog, setShowConflictDialog] = useState(false)

  const handleDeploy = useCallback(() => {
    if (hasConflicts) {
      setShowConflictDialog(true)
    } else {
      deploy()
    }
  }, [hasConflicts, deploy])

  const handleConfirmOverwrite = useCallback(() => {
    setShowConflictDialog(false)
    deploy()
  }, [deploy])

  const handleFinish = useCallback(() => {
    reset()
    router.push('/settings/nifi')
  }, [reset, router])

  const handleRetry = useCallback(() => {
    useWizardStore.getState().setDeployStatus('idle')
    useWizardStore.getState().setDeployProgress({ currentStep: '', completedSteps: [] })
  }, [])

  const newServerCount = useMemo(() => servers.filter((s) => !s.isExisting).length, [servers])
  const existingServerCount = useMemo(() => servers.filter((s) => s.isExisting).length, [servers])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Step 5: Review & Deploy</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your cluster configuration and deploy everything.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Servers */}
        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700">Servers</h3>
          </div>
          <p className="text-sm text-slate-600">
            {servers.length} server{servers.length !== 1 ? 's' : ''}
            {newServerCount > 0 && ` (${newServerCount} new)`}
            {existingServerCount > 0 && ` (${existingServerCount} existing)`}
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {servers.map((s) => (
              <li key={s.tempId}>
                {s.server_id} — {s.hostname}
                {s.isExisting && <span className="text-blue-500 ml-1">(existing)</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Instances */}
        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700">Instances</h3>
          </div>
          <p className="text-sm text-slate-600">
            {instances.length} instance{instances.length !== 1 ? 's' : ''}
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {instances.map((inst) => (
              <li key={inst.tempId} className="flex items-center gap-1">
                <span>{inst.name} — {inst.nifi_url}</span>
                {clusterConfig.primaryInstanceTempId === inst.tempId && (
                  <Crown className="h-3 w-3 text-blue-600" />
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Cluster */}
        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700">Cluster</h3>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>ID: {clusterConfig.cluster_id}</p>
            <p>Hierarchy: {clusterConfig.hierarchy_attribute} = {clusterConfig.hierarchy_value}</p>
          </div>
        </div>

        {/* Config Files */}
        <div className="rounded-lg border border-slate-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700">Config Files</h3>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Bootstrap: {bootstrapConfig.minRam} / {bootstrapConfig.maxRam} RAM</p>
            <p>Certificates: {certificates.filter((c) => c.certSubject).length}/{certificates.length} subjects</p>
            <p>Admin cert: {adminCertSubject || 'Not set'}</p>
            <p>ZK nodes: {zookeeperConfig.nodes.length}, ports: {zookeeperConfig.quorumPort}/{zookeeperConfig.leaderElectionPort}/{zookeeperConfig.clientPort}</p>
          </div>
        </div>
      </div>

      {/* Deploy status */}
      {deployStatus === 'deploying' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-700">Deploying...</span>
          </div>
          <p className="text-xs text-blue-600">{deployProgress.currentStep}</p>
          {deployProgress.completedSteps.length > 0 && (
            <ul className="text-xs text-blue-500 space-y-0.5">
              {deployProgress.completedSteps.map((step) => (
                <li key={step} className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {step}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {deployStatus === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Cluster deployed successfully! All servers, instances, cluster, and config files have been created.
          </AlertDescription>
        </Alert>
      )}

      {deployStatus === 'error' && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            Deployment failed: {deployProgress.error}
            <br />
            <span className="text-xs">
              Completed steps: {deployProgress.completedSteps.join(', ') || 'None'}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Pre-flight conflict warning */}
      {hasConflicts && deployStatus === 'idle' && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 space-y-1">
            <p className="font-medium">Existing resources detected — clicking Deploy will overwrite them:</p>
            {conflictingServers.length > 0 && (
              <p>Servers: <span className="font-mono">{conflictingServers.map((s) => s.server_id).join(', ')}</span></p>
            )}
            {conflictingInstances.length > 0 && (
              <p>Instances: <span className="font-mono">{conflictingInstances.map((i) => i.nifi_url).join(', ')}</span></p>
            )}
            {clusterConflict && (
              <p>Cluster: <span className="font-mono">{clusterConflict.cluster_id}</span></p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Overwrite confirmation dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Existing resources will be overwritten</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>The following resources already exist in the database and will be updated with the settings from this wizard:</p>
                {conflictingServers.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Servers</p>
                    <ul className="list-disc list-inside font-mono text-xs space-y-0.5">
                      {conflictingServers.map((s) => (
                        <li key={s.tempId}>{s.server_id} ({s.hostname})</li>
                      ))}
                    </ul>
                  </div>
                )}
                {conflictingInstances.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">NiFi Instances</p>
                    <ul className="list-disc list-inside font-mono text-xs space-y-0.5">
                      {conflictingInstances.map((i) => (
                        <li key={i.tempId}>{i.name || i.nifi_url} ({i.nifi_url})</li>
                      ))}
                    </ul>
                  </div>
                )}
                {clusterConflict && (
                  <div>
                    <p className="font-medium mb-1">Cluster</p>
                    <p className="font-mono text-xs">{clusterConflict.cluster_id}</p>
                  </div>
                )}
                <p>Do you want to continue?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              Overwrite & Deploy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        {deployStatus === 'idle' && (
          <Button onClick={handleDeploy} className="bg-green-600 hover:bg-green-700">
            <Rocket className="mr-2 h-4 w-4" />
            Deploy Cluster
          </Button>
        )}
        {deployStatus === 'error' && (
          <Button onClick={handleRetry} variant="outline">
            Retry
          </Button>
        )}
        {deployStatus === 'success' && (
          <Button onClick={handleFinish}>
            Go to NiFi Settings
          </Button>
        )}
      </div>
    </div>
  )
}
