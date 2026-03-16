'use client'

import { useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWizardStore } from '../wizard-store'
import { CertificatesTab } from '../config-tabs/certificates-tab'
import { BootstrapTab } from '../config-tabs/bootstrap-tab'
import { AuthorizersTab } from '../config-tabs/authorizers-tab'
import { ZookeeperTab } from '../config-tabs/zookeeper-tab'
import { NifiPropertiesTab } from '../config-tabs/nifi-properties-tab'

export function StepConfigFiles() {
  const configSubTab = useWizardStore((s) => s.configSubTab)
  const setConfigSubTab = useWizardStore((s) => s.setConfigSubTab)
  const syncCertificatesFromInstances = useWizardStore((s) => s.syncCertificatesFromInstances)
  const syncZookeeperFromInstances = useWizardStore((s) => s.syncZookeeperFromInstances)

  useEffect(() => {
    syncCertificatesFromInstances()
    syncZookeeperFromInstances()
  }, [syncCertificatesFromInstances, syncZookeeperFromInstances])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Step 4: Configuration Files</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the files that will be committed to each instance&apos;s git config repository.
        </p>
      </div>

      <Tabs value={configSubTab} onValueChange={setConfigSubTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="bootstrap">Bootstrap</TabsTrigger>
          <TabsTrigger value="authorizers">Authorizers</TabsTrigger>
          <TabsTrigger value="zookeeper">ZooKeeper</TabsTrigger>
          <TabsTrigger value="nifi-properties">NiFi Properties</TabsTrigger>
        </TabsList>
        <TabsContent value="certificates" className="mt-4">
          <CertificatesTab />
        </TabsContent>
        <TabsContent value="bootstrap" className="mt-4">
          <BootstrapTab />
        </TabsContent>
        <TabsContent value="authorizers" className="mt-4">
          <AuthorizersTab />
        </TabsContent>
        <TabsContent value="zookeeper" className="mt-4">
          <ZookeeperTab />
        </TabsContent>
        <TabsContent value="nifi-properties" className="mt-4">
          <NifiPropertiesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
