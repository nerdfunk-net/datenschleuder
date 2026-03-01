'use client'

import { Server } from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ServersTab } from './tabs/servers-tab'
import { NifiInstancesTab } from './tabs/nifi-instances-tab'
import { ClustersTab } from './tabs/clusters-tab'

export function NifiInstancesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">NiFi Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage NiFi servers, instances, and clusters
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="servers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="instances">NiFi Instances</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
        </TabsList>
        <TabsContent value="servers" className="space-y-6">
          <ServersTab />
        </TabsContent>
        <TabsContent value="instances" className="space-y-6">
          <NifiInstancesTab />
        </TabsContent>
        <TabsContent value="clusters" className="space-y-6">
          <ClustersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
