'use client'

import { useCallback } from 'react'
import { Crown, Network } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useWizardStore } from '../wizard-store'
import {
  useNifiHierarchyQuery,
  useNifiHierarchyValuesQuery,
} from '../../hooks/use-nifi-instances-query'

export function StepCluster() {
  const instances = useWizardStore((s) => s.instances)
  const servers = useWizardStore((s) => s.servers)
  const clusterConfig = useWizardStore((s) => s.clusterConfig)
  const updateClusterConfig = useWizardStore((s) => s.updateClusterConfig)

  const { data: hierarchyData } = useNifiHierarchyQuery()
  const hierarchyAttributes = hierarchyData?.hierarchy ?? []

  const { data: hierarchyValuesData } = useNifiHierarchyValuesQuery(
    clusterConfig.hierarchy_attribute
  )
  const hierarchyValues = hierarchyValuesData?.values ?? []

  const handleSetPrimary = useCallback(
    (instanceTempId: string) => {
      updateClusterConfig({ primaryInstanceTempId: instanceTempId })
    },
    [updateClusterConfig]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Step 3: Cluster Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define the cluster identity and select which instance is the primary node.
        </p>
      </div>

      {/* Cluster fields */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="cluster-id">Cluster ID *</Label>
            <Input
              id="cluster-id"
              placeholder="e.g. prod-cluster"
              value={clusterConfig.cluster_id}
              onChange={(e) => updateClusterConfig({ cluster_id: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="hierarchy-attr">Hierarchy Attribute *</Label>
            <Select
              value={clusterConfig.hierarchy_attribute}
              onValueChange={(v) =>
                updateClusterConfig({ hierarchy_attribute: v, hierarchy_value: '' })
              }
            >
              <SelectTrigger id="hierarchy-attr">
                <SelectValue placeholder="Select attribute..." />
              </SelectTrigger>
              <SelectContent>
                {hierarchyAttributes.map((attr) => (
                  <SelectItem key={attr.name} value={attr.name}>
                    {attr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="hierarchy-value">Hierarchy Value *</Label>
            <Select
              value={clusterConfig.hierarchy_value}
              onValueChange={(v) => updateClusterConfig({ hierarchy_value: v })}
              disabled={!clusterConfig.hierarchy_attribute}
            >
              <SelectTrigger id="hierarchy-value">
                <SelectValue placeholder="Select value..." />
              </SelectTrigger>
              <SelectContent>
                {hierarchyValues.map((val) => (
                  <SelectItem key={val} value={val}>
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Members / Primary selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700">
          Cluster Members ({instances.length})
        </h3>
        <p className="text-xs text-muted-foreground">
          All instances from Step 2 will be added to this cluster. Select exactly one primary node.
        </p>

        {instances.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Network className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm">No instances configured. Go back to Step 2 to add instances.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instances.map((inst) => {
              const server = servers.find((s) => s.tempId === inst.serverTempId)
              const isPrimary = clusterConfig.primaryInstanceTempId === inst.tempId
              return (
                <button
                  key={inst.tempId}
                  type="button"
                  onClick={() => handleSetPrimary(inst.tempId)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors
                    ${isPrimary ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Network className={`h-5 w-5 ${isPrimary ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {server?.server_id} &middot; {inst.nifi_url}
                      </p>
                    </div>
                  </div>
                  {isPrimary ? (
                    <Badge className="bg-blue-600 text-white">
                      <Crown className="mr-1 h-3 w-3" />
                      Primary
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400">
                      Secondary
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
