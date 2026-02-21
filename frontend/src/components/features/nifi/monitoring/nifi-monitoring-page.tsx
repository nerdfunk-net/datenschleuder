'use client'

import { Activity } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InstancesTab } from './tabs/instances-tab'
import { FlowsTab } from './tabs/flows-tab'
import { QueuesTab } from './tabs/queues-tab'

export function NifiMonitoringPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">NiFi Monitoring</h1>
            <p className="text-muted-foreground mt-2">
              Monitor NiFi system diagnostics and flows
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="instances" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="instances">NiFi Instances</TabsTrigger>
          <TabsTrigger value="flows">NiFi Flows</TabsTrigger>
          <TabsTrigger value="queues">NiFi Queues</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-6">
          <InstancesTab />
        </TabsContent>

        <TabsContent value="flows" className="space-y-6">
          <FlowsTab />
        </TabsContent>

        <TabsContent value="queues" className="space-y-6">
          <QueuesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
