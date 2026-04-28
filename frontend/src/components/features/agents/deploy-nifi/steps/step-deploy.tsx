'use client'

import { useCallback, useMemo } from 'react'
import { Rocket, CheckCircle2, XCircle, Loader2, FolderOpen, Server, GitBranch, Key, Settings } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useDeployNifiStore } from '../wizard-store'
import { useDeployNifiMutation } from '../hooks/use-deploy-nifi-mutation'
import { VOLUME_DIR_KEYS } from '../constants'
import type { DeployNifiPayload } from '../types'

export function StepDeploy() {
  const selectedAgentId = useDeployNifiStore((s) => s.selectedAgentId)
  const selectedGitRepoName = useDeployNifiStore((s) => s.selectedGitRepoName)
  const selectedGitRepoUrl = useDeployNifiStore((s) => s.selectedGitRepoUrl)
  const selectedGitRepoBranch = useDeployNifiStore((s) => s.selectedGitRepoBranch)
  const selectedCredentialName = useDeployNifiStore((s) => s.selectedCredentialName)
  const selectedCredentialId = useDeployNifiStore((s) => s.selectedCredentialId)
  const targetDirectory = useDeployNifiStore((s) => s.targetDirectory)
  const properties = useDeployNifiStore((s) => s.properties)
  const composeContent = useDeployNifiStore((s) => s.composeContent)
  const createDirectories = useDeployNifiStore((s) => s.createDirectories)
  const deployStatus = useDeployNifiStore((s) => s.deployStatus)
  const deployResult = useDeployNifiStore((s) => s.deployResult)
  const deployError = useDeployNifiStore((s) => s.deployError)
  const setCreateDirectories = useDeployNifiStore((s) => s.setCreateDirectories)
  const setDeployStatus = useDeployNifiStore((s) => s.setDeployStatus)
  const setDeployResult = useDeployNifiStore((s) => s.setDeployResult)
  const setDeployError = useDeployNifiStore((s) => s.setDeployError)

  const configuredCount = useMemo(
    () => Object.values(properties).filter((v) => !!v.trim()).length,
    [properties]
  )

  const volumeDirs = useMemo(
    () =>
      Object.fromEntries(
        VOLUME_DIR_KEYS.filter((k) => !!properties[k]).map((k) => [k, properties[k] as string])
      ) as Record<string, string>,
    [properties]
  )

  const { mutate: deploy, isPending } = useDeployNifiMutation({
    agentId: selectedAgentId ?? '',
    onSuccess: (output) => {
      setDeployStatus('success')
      setDeployResult(output)
    },
    onError: (error) => {
      setDeployStatus('error')
      setDeployError(error)
    },
  })

  const handleDeploy = useCallback(() => {
    if (!selectedAgentId) return
    setDeployStatus('deploying')
    setDeployResult(null)
    setDeployError(null)

    const payload: DeployNifiPayload = {
      target_directory: targetDirectory,
      compose_content: composeContent,
      create_directories: createDirectories,
      volume_dirs: volumeDirs,
      conf_dir: properties['SRC_CONF_DIR'] || null,
      git_repo_url: selectedGitRepoUrl,
      git_branch: selectedGitRepoBranch,
      credential_id: selectedCredentialId,
    }
    deploy(payload)
  }, [
    selectedAgentId,
    targetDirectory,
    composeContent,
    createDirectories,
    volumeDirs,
    properties,
    selectedGitRepoUrl,
    selectedGitRepoBranch,
    selectedCredentialId,
    deploy,
    setDeployStatus,
    setDeployResult,
    setDeployError,
  ])

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <Settings className="h-4 w-4" />
          <span className="text-sm font-medium">Deployment Summary</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 pr-4 w-48 align-middle">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Server className="h-4 w-4" />
                    Agent
                  </div>
                </td>
                <td className="py-2 align-middle">
                  <span className="font-mono text-sm">{selectedAgentId ?? '—'}</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-middle">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <GitBranch className="h-4 w-4" />
                    Git Repository
                  </div>
                </td>
                <td className="py-2 align-middle">
                  <span className="text-sm">
                    {selectedGitRepoName ?? '—'}
                    {selectedGitRepoUrl && (
                      <span className="text-gray-400 ml-2 text-xs">
                        ({selectedGitRepoBranch})
                      </span>
                    )}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-middle">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Key className="h-4 w-4" />
                    Credential
                  </div>
                </td>
                <td className="py-2 align-middle">
                  <span className="text-sm">{selectedCredentialName ?? 'None'}</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-middle">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FolderOpen className="h-4 w-4" />
                    Target Directory
                  </div>
                </td>
                <td className="py-2 align-middle">
                  <span className="font-mono text-sm">{targetDirectory || '—'}</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-middle">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Settings className="h-4 w-4" />
                    Properties configured
                  </div>
                </td>
                <td className="py-2 align-middle">
                  <span className="text-sm">{configuredCount} / {Object.keys(properties).length}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Options */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <Rocket className="h-4 w-4" />
          <span className="text-sm font-medium">Deployment Options</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
            <Switch
              id="create-dirs"
              checked={createDirectories}
              onCheckedChange={setCreateDirectories}
              disabled={deployStatus === 'deploying'}
            />
            <div className="flex-1">
              <Label htmlFor="create-dirs" className="text-sm font-medium cursor-pointer">
                Create directories if missing
              </Label>
              <p className="text-xs text-gray-600 mt-0.5">
                Automatically create all SRC_* volume directories on the agent host if they
                do not already exist.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deploy button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleDeploy}
          disabled={isPending || deployStatus === 'deploying' || deployStatus === 'success'}
        >
          {isPending || deployStatus === 'deploying' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Deploying…
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              Deploy NiFi
            </>
          )}
        </Button>
      </div>

      {/* Result */}
      {deployStatus === 'success' && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <p className="font-medium mb-1">Deployment successful</p>
            {deployResult && (
              <pre className="font-mono text-xs whitespace-pre-wrap mt-2 bg-green-100 rounded p-2">
                {deployResult}
              </pre>
            )}
          </AlertDescription>
        </Alert>
      )}

      {deployStatus === 'error' && (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <p className="font-medium mb-1">Deployment failed</p>
            {deployError && (
              <pre className="font-mono text-xs whitespace-pre-wrap mt-2 bg-red-100 rounded p-2">
                {deployError}
              </pre>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
