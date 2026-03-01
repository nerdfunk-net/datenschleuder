'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, X, Network } from 'lucide-react'
import { useNifiInstancesQuery } from '../hooks/use-nifi-instances-query'
import { useNifiClustersQuery } from '../hooks/use-nifi-clusters-query'
import { useNifiClustersMutations } from '../hooks/use-nifi-clusters-mutations'
import type { NifiCluster, NifiInstance } from '../types'

const EMPTY_INSTANCES: NifiInstance[] = []
const EMPTY_CLUSTERS: NifiCluster[] = []
const EMPTY_STRINGS: string[] = []

const schema = z.object({
  cluster_id: z.string().min(1, 'Required'),
  hierarchy_attribute: z.string().min(1, 'Required'),
  hierarchy_value: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

interface MemberRow {
  instance_id: number
  is_primary: boolean
}

const NO_INSTANCE = '__none__'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cluster?: NifiCluster | null
}

export function NifiClusterDialog({ open, onOpenChange, cluster }: Props) {
  const isEdit = !!cluster
  const { createCluster, updateCluster } = useNifiClustersMutations()
  const { data: allInstances = EMPTY_INSTANCES } = useNifiInstancesQuery()
  const { data: allClusters = EMPTY_CLUSTERS } = useNifiClustersQuery()
  const { apiCall } = useApi()

  const [members, setMembers] = useState<MemberRow[]>([])
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(NO_INSTANCE)
  const [membersError, setMembersError] = useState<string | null>(null)

  const justInitializedRef = useRef(false)

  // instance_ids already claimed by OTHER clusters
  const claimedInstanceIds = useMemo(() => {
    const claimed = new Set<number>()
    for (const c of allClusters) {
      if (isEdit && c.id === cluster?.id) continue
      for (const m of c.members) {
        claimed.add(m.instance_id)
      }
    }
    return claimed
  }, [allClusters, isEdit, cluster])

  // Instances available to add: not already a member, not claimed by another cluster
  const availableInstances = useMemo(() => {
    const memberInstanceIds = new Set(members.map(m => m.instance_id))
    return allInstances.filter(
      i => !memberInstanceIds.has(i.id) && !claimedInstanceIds.has(i.id)
    )
  }, [allInstances, members, claimedInstanceIds])

  // Enrich member rows with display info derived from allInstances
  const membersWithDisplay = useMemo(() =>
    members.map(m => {
      const inst = allInstances.find(i => i.id === m.instance_id)
      return {
        instance_id: m.instance_id,
        is_primary: m.is_primary,
        display_name: inst?.name || inst?.nifi_url || `Instance #${m.instance_id}`,
        display_url: inst?.name ? inst.nifi_url : '',
      }
    }),
    [members, allInstances]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cluster_id: '', hierarchy_attribute: '', hierarchy_value: '' },
  })

  const selectedAttribute = useWatch({ control: form.control, name: 'hierarchy_attribute' })

  const { data: hierarchyConfigData, isLoading: loadingAttributes } = useQuery<{ hierarchy: Array<{ name: string; label: string }> }>({
    queryKey: queryKeys.nifi.hierarchy(),
    queryFn: () => apiCall('nifi/hierarchy/') as Promise<{ hierarchy: Array<{ name: string; label: string }> }>,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const hierarchyAttributes = useMemo(
    () => hierarchyConfigData?.hierarchy?.map(a => a.name) ?? EMPTY_STRINGS,
    [hierarchyConfigData]
  )

  const { data: hierarchyValuesData, isLoading: loadingValues } = useQuery<{ values: string[] }>({
    queryKey: queryKeys.nifi.hierarchyValues(selectedAttribute),
    queryFn: () => apiCall(`nifi/hierarchy/values/${selectedAttribute}`) as Promise<{ values: string[] }>,
    staleTime: 5 * 60 * 1000,
    enabled: open && !!selectedAttribute,
  })
  const hierarchyValues = useMemo(
    () => hierarchyValuesData?.values ?? EMPTY_STRINGS,
    [hierarchyValuesData]
  )

  // Clear hierarchy_value when the user changes hierarchy_attribute (but not on form init)
  useEffect(() => {
    if (justInitializedRef.current) {
      justInitializedRef.current = false
      return
    }
    form.setValue('hierarchy_value', '')
  }, [selectedAttribute, form])

  useEffect(() => {
    if (!open) return
    justInitializedRef.current = true
    if (cluster) {
      form.reset({
        cluster_id: cluster.cluster_id,
        hierarchy_attribute: cluster.hierarchy_attribute,
        hierarchy_value: cluster.hierarchy_value,
      })
      setMembers(
        cluster.members.map(m => ({
          instance_id: m.instance_id,
          is_primary: m.is_primary,
        }))
      )
    } else {
      form.reset({ cluster_id: '', hierarchy_attribute: '', hierarchy_value: '' })
      setMembers([])
    }
    setSelectedInstanceId(NO_INSTANCE)
    setMembersError(null)
  }, [open, cluster, form])

  const handleAddInstance = useCallback(() => {
    if (!selectedInstanceId || selectedInstanceId === NO_INSTANCE) return
    const inst = allInstances.find(i => i.id === Number(selectedInstanceId))
    if (!inst) return
    setMembers(prev => [
      ...prev,
      {
        instance_id: inst.id,
        is_primary: prev.length === 0,
      },
    ])
    setSelectedInstanceId(NO_INSTANCE)
    setMembersError(null)
  }, [selectedInstanceId, allInstances])

  const handleRemoveMember = useCallback((instanceId: number) => {
    setMembers(prev => {
      const next = prev.filter(m => m.instance_id !== instanceId)
      const hadPrimary = prev.find(m => m.instance_id === instanceId)?.is_primary
      if (hadPrimary && next.length > 0 && !next.some(m => m.is_primary)) {
        return next.map((m, i) => (i === 0 ? { ...m, is_primary: true } : m))
      }
      return next
    })
  }, [])

  const handleSetPrimary = useCallback((instanceId: number) => {
    setMembers(prev =>
      prev.map(m => ({ ...m, is_primary: m.instance_id === instanceId }))
    )
  }, [])

  const validate = useCallback(() => {
    if (members.length === 0) {
      setMembersError('At least one NiFi instance is required')
      return false
    }
    const primaryCount = members.filter(m => m.is_primary).length
    if (primaryCount === 0) {
      setMembersError('Exactly one instance must be marked as primary')
      return false
    }
    if (primaryCount > 1) {
      setMembersError('Only one instance can be the primary')
      return false
    }
    setMembersError(null)
    return true
  }, [members])

  const onSubmit = async (values: FormValues) => {
    if (!validate()) return

    const payload = {
      cluster_id: values.cluster_id,
      hierarchy_attribute: values.hierarchy_attribute,
      hierarchy_value: values.hierarchy_value,
      members: members.map(m => ({ instance_id: m.instance_id, is_primary: m.is_primary })),
    }

    if (isEdit && cluster) {
      await updateCluster.mutateAsync({ id: cluster.id, data: payload })
    } else {
      await createCluster.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  const isPending = createCluster.isPending || updateCluster.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit NiFi Cluster' : 'Add NiFi Cluster'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cluster_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cluster ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. prod-cluster" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hierarchy_attribute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hierarchy Attribute</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={loadingAttributes}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={loadingAttributes ? 'Loading…' : 'Select attribute'}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {hierarchyAttributes.map(attr => (
                          <SelectItem key={attr} value={attr}>{attr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hierarchy_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hierarchy Value</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedAttribute || loadingValues}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedAttribute
                                ? 'Select attribute first'
                                : loadingValues
                                ? 'Loading…'
                                : 'Select value'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {hierarchyValues.map(val => (
                          <SelectItem key={val} value={val}>{val}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Member NiFi Instances */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              {/* Panel header */}
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
                <Network className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Member NiFi Instances</span>
                {members.length > 0 && (
                  <Badge variant="outline" className="ml-auto text-xs text-slate-500">
                    {members.length}
                  </Badge>
                )}
              </div>

              <div className="p-3 space-y-2">
                {/* Current members */}
                {membersWithDisplay.length > 0 && (
                  <div className="space-y-1.5">
                    {membersWithDisplay.map(m => (
                      <div
                        key={m.instance_id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                          m.is_primary
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {m.display_name}
                          </p>
                          {m.display_url && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {m.display_url}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {m.is_primary ? (
                            <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">
                              Primary
                            </Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(m.instance_id)}
                              className="text-xs text-slate-400 hover:text-blue-600 transition-colors whitespace-nowrap flex items-center gap-1"
                            >
                              <Checkbox
                                checked={false}
                                onCheckedChange={() => handleSetPrimary(m.instance_id)}
                                className="pointer-events-none"
                              />
                              Set primary
                            </button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                            onClick={() => handleRemoveMember(m.instance_id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add instance row */}
                <div className="flex items-center gap-2 pt-1">
                  <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                    <SelectTrigger className="flex-1 bg-white border-slate-300 focus:border-blue-400">
                      <SelectValue placeholder="Select a NiFi instance to add…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInstances.length === 0 ? (
                        <SelectItem value={NO_INSTANCE} disabled>
                          No available instances
                        </SelectItem>
                      ) : (
                        availableInstances.map(inst => (
                          <SelectItem key={inst.id} value={String(inst.id)}>
                            <div className="flex flex-col py-0.5">
                              <span className="font-medium text-slate-900">
                                {inst.name || inst.nifi_url}
                              </span>
                              {inst.name && (
                                <span className="text-xs text-slate-400">{inst.nifi_url}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddInstance}
                    disabled={!selectedInstanceId || selectedInstanceId === NO_INSTANCE}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {membersError && (
                  <p className="text-xs text-red-600">{membersError}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Create'} Cluster
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
