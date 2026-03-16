'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus, Server, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWizardStore } from '../wizard-store'
import { useNifiServersQuery } from '../../hooks/use-nifi-servers-query'
import { useApi } from '@/hooks/use-api'
import { useQuery } from '@tanstack/react-query'

interface Credential {
  id: number
  name: string
  credential_type: string
}

const NO_CREDENTIAL = '__none__'

export function StepServers() {
  const servers = useWizardStore((s) => s.servers)
  const addServer = useWizardStore((s) => s.addServer)
  const removeServer = useWizardStore((s) => s.removeServer)

  const { data: existingServers } = useNifiServersQuery()
  const allServers = useMemo(() => existingServers ?? [], [existingServers])

  const { apiCall } = useApi()
  const { data: credentialsData } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => apiCall<{ credentials: Credential[] }>('credentials'),
    staleTime: 30_000,
  })
  const sshCredentials = useMemo(
    () =>
      (credentialsData?.credentials ?? []).filter(
        (c) => c.credential_type === 'ssh' || c.credential_type === 'ssh_key'
      ),
    [credentialsData]
  )

  // Track which existing servers are already added
  const addedExistingIds = useMemo(
    () => new Set(servers.filter((srv) => srv.isExisting).map((srv) => srv.existingId)),
    [servers]
  )
  const availableExisting = useMemo(
    () => allServers.filter((srv) => !addedExistingIds.has(srv.id)),
    [allServers, addedExistingIds]
  )

  // Add existing server
  const [selectedExistingId, setSelectedExistingId] = useState('')

  const handleAddExisting = useCallback(() => {
    const srv = allServers.find((item) => item.id === Number(selectedExistingId))
    if (!srv) return
    addServer({
      tempId: `existing-${srv.id}`,
      isExisting: true,
      existingId: srv.id,
      server_id: srv.server_id,
      hostname: srv.hostname,
      credential_id: srv.credential_id,
      credential_name: srv.credential_name,
    })
    setSelectedExistingId('')
  }, [selectedExistingId, allServers, addServer])

  // Create new server form
  const [newServerId, setNewServerId] = useState('')
  const [newHostname, setNewHostname] = useState('')
  const [newCredentialId, setNewCredentialId] = useState(NO_CREDENTIAL)

  const handleCreateNew = useCallback(() => {
    if (!newServerId.trim() || !newHostname.trim()) return
    const credId = newCredentialId !== NO_CREDENTIAL ? Number(newCredentialId) : null
    const credName =
      credId !== null
        ? sshCredentials.find((c) => c.id === credId)?.name ?? null
        : null
    addServer({
      tempId: `new-${Date.now()}`,
      isExisting: false,
      server_id: newServerId.trim(),
      hostname: newHostname.trim(),
      credential_id: credId,
      credential_name: credName,
    })
    setNewServerId('')
    setNewHostname('')
    setNewCredentialId(NO_CREDENTIAL)
  }, [newServerId, newHostname, newCredentialId, sshCredentials, addServer])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Step 1: Servers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add the servers that will host your NiFi instances. You can select existing servers or create new ones.
        </p>
      </div>

      {/* Add existing server */}
      {availableExisting.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-700">Add Existing Server</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="existing-server">Server</Label>
              <Select value={selectedExistingId} onValueChange={setSelectedExistingId}>
                <SelectTrigger id="existing-server">
                  <SelectValue placeholder="Select a server..." />
                </SelectTrigger>
                <SelectContent>
                  {availableExisting.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.server_id} ({s.hostname})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddExisting} disabled={!selectedExistingId} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Create new server */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-medium text-slate-700">Create New Server</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="new-server-id">Server ID</Label>
            <Input
              id="new-server-id"
              placeholder="e.g. nifi-node-1"
              value={newServerId}
              onChange={(e) => setNewServerId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-hostname">Hostname</Label>
            <Input
              id="new-hostname"
              placeholder="e.g. 10.0.0.1"
              value={newHostname}
              onChange={(e) => setNewHostname(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-credential">SSH Credential (optional)</Label>
            <Select value={newCredentialId} onValueChange={setNewCredentialId}>
              <SelectTrigger id="new-credential">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CREDENTIAL}>None</SelectItem>
                {sshCredentials.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={handleCreateNew}
          disabled={!newServerId.trim() || !newHostname.trim()}
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          Create & Add
        </Button>
      </div>

      {/* Server list */}
      {servers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700">
            Added Servers ({servers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {servers.map((srv) => (
              <div
                key={srv.tempId}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{srv.server_id}</p>
                    <p className="text-xs text-muted-foreground">{srv.hostname}</p>
                    {srv.isExisting && (
                      <span className="text-xs text-blue-600">Existing</span>
                    )}
                    {!srv.isExisting && (
                      <span className="text-xs text-green-600">New</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeServer(srv.tempId)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {servers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Server className="mx-auto h-12 w-12 text-slate-300 mb-2" />
          <p>No servers added yet. Add at least one server to continue.</p>
        </div>
      )}
    </div>
  )
}
