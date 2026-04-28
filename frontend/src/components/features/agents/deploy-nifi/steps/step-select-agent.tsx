'use client'

import { useCallback, useMemo } from 'react'
import { Server, GitBranch, Key, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAgentsQuery } from '../../operating/hooks/use-agents-query'
import { useGitRepositories } from '@/components/features/shared/git/hooks/use-git-repositories'
import { useCredentialsQuery } from '@/components/features/settings/credentials/hooks/queries/use-credentials-query'
import { useDeployNifiStore } from '../wizard-store'

export function StepSelectAgent() {
  const selectedAgentId = useDeployNifiStore((s) => s.selectedAgentId)
  const selectedGitRepoId = useDeployNifiStore((s) => s.selectedGitRepoId)
  const selectedCredentialId = useDeployNifiStore((s) => s.selectedCredentialId)
  const setAgentId = useDeployNifiStore((s) => s.setAgentId)
  const setGitRepo = useDeployNifiStore((s) => s.setGitRepo)
  const setCredential = useDeployNifiStore((s) => s.setCredential)

  const { data: agentsData, isLoading: agentsLoading } = useAgentsQuery()
  const { repositories, loading: reposLoading } = useGitRepositories()
  const { data: credentials, isLoading: credsLoading } = useCredentialsQuery()

  const onlineAgents = useMemo(
    () => (agentsData?.agents ?? []).filter((a) => a.status === 'online'),
    [agentsData]
  )

  const handleAgentChange = useCallback(
    (value: string) => setAgentId(value || null),
    [setAgentId]
  )

  const handleGitRepoChange = useCallback(
    (value: string) => {
      const repo = repositories.find((r) => String(r.id) === value)
      if (repo) {
        setGitRepo(repo.id, repo.url, repo.branch ?? 'main', repo.name)
      } else {
        setGitRepo(null, null, 'main', null)
      }
    },
    [repositories, setGitRepo]
  )

  const handleCredentialChange = useCallback(
    (value: string) => {
      const cred = (credentials ?? []).find((c: { id: number; name: string }) => String(c.id) === value)
      if (cred) {
        setCredential(cred.id, cred.name)
      } else {
        setCredential(null, null)
      }
    },
    [credentials, setCredential]
  )

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Select the agent that will perform the deployment, the git repository for NiFi
          configuration storage, and the credentials needed to access git.
        </AlertDescription>
      </Alert>

      {/* Agent selection */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">Target Agent</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-2">
          <Label htmlFor="agent-select" className="text-sm">
            Agent <span className="text-red-500">*</span>
          </Label>
          {agentsLoading ? (
            <p className="text-sm text-gray-500">Loading agents…</p>
          ) : onlineAgents.length === 0 ? (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No online agents found. Start an agent and refresh.
              </AlertDescription>
            </Alert>
          ) : (
            <Select value={selectedAgentId ?? ''} onValueChange={handleAgentChange}>
              <SelectTrigger id="agent-select">
                <SelectValue placeholder="Select an agent…" />
              </SelectTrigger>
              <SelectContent>
                {onlineAgents.map((agent) => (
                  <SelectItem key={agent.agent_id} value={agent.agent_id}>
                    {agent.agent_id} — {agent.hostname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-gray-500">Only online agents are shown.</p>
        </div>
      </div>

      {/* Git repository selection */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <GitBranch className="h-4 w-4" />
          <span className="text-sm font-medium">Git Repository (NiFi Config)</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-2">
          <Label htmlFor="git-repo-select" className="text-sm">
            Repository
          </Label>
          {reposLoading ? (
            <p className="text-sm text-gray-500">Loading repositories…</p>
          ) : (
            <Select
              value={selectedGitRepoId !== null ? String(selectedGitRepoId) : ''}
              onValueChange={handleGitRepoChange}
            >
              <SelectTrigger id="git-repo-select">
                <SelectValue placeholder="Select a repository…" />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((repo) => (
                  <SelectItem key={repo.id} value={String(repo.id)}>
                    {repo.name} — {repo.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-gray-500">
            The content of this repository will be cloned into the NiFi conf directory
            (SRC_CONF_DIR). Configure repositories under Settings / Git Management.
          </p>
        </div>
      </div>

      {/* Credential selection */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <Key className="h-4 w-4" />
          <span className="text-sm font-medium">Git Credentials</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-2">
          <Label htmlFor="cred-select" className="text-sm">
            Credential
          </Label>
          {credsLoading ? (
            <p className="text-sm text-gray-500">Loading credentials…</p>
          ) : (
            <Select
              value={selectedCredentialId !== null ? String(selectedCredentialId) : ''}
              onValueChange={handleCredentialChange}
            >
              <SelectTrigger id="cred-select">
                <SelectValue placeholder="Select a credential…" />
              </SelectTrigger>
              <SelectContent>
                {(credentials ?? []).map((cred: { id: number; name: string; type: string; username: string }) => (
                  <SelectItem key={cred.id} value={String(cred.id)}>
                    {cred.name} ({cred.type}) — {cred.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-gray-500">
            Used when cloning the git repository. Configure credentials under Settings /
            Credentials.
          </p>
        </div>
      </div>
    </div>
  )
}
