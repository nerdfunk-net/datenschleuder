'use client'

import { useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWizardStore } from '../wizard-store'

export function ZookeeperTab() {
  const instances = useWizardStore((s) => s.instances)
  const zookeeperConfig = useWizardStore((s) => s.zookeeperConfig)
  const updateZookeeperNode = useWizardStore((s) => s.updateZookeeperNode)
  const updateZookeeperPorts = useWizardStore((s) => s.updateZookeeperPorts)

  const handlePortChange = useCallback(
    (field: 'quorumPort' | 'leaderElectionPort' | 'clientPort', value: string) => {
      const num = parseInt(value, 10)
      if (!isNaN(num)) {
        updateZookeeperPorts({ [field]: num })
      }
    },
    [updateZookeeperPorts]
  )

  const allHostnamesFilled = useMemo(
    () => zookeeperConfig.nodes.length > 0 && zookeeperConfig.nodes.every((n) => n.hostname.trim()),
    [zookeeperConfig.nodes]
  )

  const preview = useMemo(() => {
    if (!allHostnamesFilled) return ''
    return zookeeperConfig.nodes
      .map(
        (n, i) =>
          `server.${i + 1}=${n.hostname}:${zookeeperConfig.quorumPort}:${zookeeperConfig.leaderElectionPort};${zookeeperConfig.clientPort}`
      )
      .join('\n')
  }, [zookeeperConfig, allHostnamesFilled])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-700">ZooKeeper Configuration</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure the ZooKeeper ensemble for cluster coordination. Hostnames are pre-filled from server hostnames.
        </p>
      </div>

      {/* Ports */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-medium text-slate-600">Ports</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="zk-quorum">Quorum Port</Label>
            <Input
              id="zk-quorum"
              type="number"
              value={zookeeperConfig.quorumPort}
              onChange={(e) => handlePortChange('quorumPort', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="zk-leader">Leader Election Port</Label>
            <Input
              id="zk-leader"
              type="number"
              value={zookeeperConfig.leaderElectionPort}
              onChange={(e) => handlePortChange('leaderElectionPort', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="zk-client">Client Port</Label>
            <Input
              id="zk-client"
              type="number"
              value={zookeeperConfig.clientPort}
              onChange={(e) => handlePortChange('clientPort', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Per-node hostnames */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-600">Node Hostnames</h4>
        {zookeeperConfig.nodes.map((node, idx) => {
          const inst = instances.find((i) => i.tempId === node.instanceTempId)
          return (
            <div key={node.instanceTempId} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">
                server.{idx + 1}
              </span>
              <span className="text-xs text-slate-500 w-28 shrink-0 truncate">
                {inst?.name}
              </span>
              <Input
                value={node.hostname}
                onChange={(e) => updateZookeeperNode(node.instanceTempId, e.target.value)}
                placeholder="hostname"
                className="flex-1"
              />
            </div>
          )
        })}
      </div>

      {/* Preview */}
      {allHostnamesFilled && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-600">Preview (server entries)</h4>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <pre className="text-xs text-slate-800 whitespace-pre">{preview}</pre>
          </div>
        </div>
      )}

      {zookeeperConfig.nodes.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No instances configured. Go back to Step 2 to add instances.
        </p>
      )}
    </div>
  )
}
