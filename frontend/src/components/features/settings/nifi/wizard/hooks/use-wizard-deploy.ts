import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useWizardStore } from '../wizard-store'
import { generateAuthorizersXml } from '../utils/authorizers-generator'
import { generateZookeeperProperties } from '../utils/zookeeper-generator'
import { generateBootstrapConf } from '../../utils/bootstrap-parser'
import type { NifiServer, NifiInstance, NifiCluster } from '../../types'
import type { DeployProgress } from '../types'

const BOOTSTRAP_TEMPLATE = `#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Username to use when running NiFi. This value will be ignored on Windows.
run.as=

# Preserve shell environment while runnning as "run.as" user
preserve.environment=false

# Configure where NiFi's lib and conf directories live
lib.dir=./lib
conf.dir=./conf

# How long to wait after telling NiFi to shutdown before explicitly killing the Process
graceful.shutdown.seconds=20

# JVM memory settings
java.arg.2=-Xms1g
java.arg.3=-Xmx1g

# Enable Remote Debugging
#java.arg.debug=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=8000

# allowRestrictedHeaders is required for Cluster/Node communications to work properly
java.arg.5=-Dsun.net.http.allowRestrictedHeaders=true
java.arg.6=-Djava.protocol.handler.pkgs=sun.net.www.protocol

# Enable Headless mode to avoid HeadlessException with Java AWT libraries
java.arg.headless=-Djava.awt.headless=true

# Configure Apache Curator connection logging for Apache ZooKeeper to avoid excessive ERROR messages
java.arg.curatorLogOnlyFirstConnectionIssue=-Dcurator-log-only-first-connection-issue-as-error-level=true

# Requires JAAS to use only the provided JAAS configuration to authenticate a Subject, without using any "fallback" methods (such as prompting for username/password)
# Please see https://docs.oracle.com/en/java/javase/21/security/single-sign-using-kerberos-java1.html, section "EXCEPTIONS TO THE MODEL"
java.arg.securityAuthUseSubjectCredsOnly=-Djavax.security.auth.useSubjectCredsOnly=true
`

export function useWizardDeploy() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()

  const deploy = useCallback(async () => {
    const state = useWizardStore.getState()
    const { setDeployStatus, setDeployProgress } = state

    setDeployStatus('deploying')
    const progress: DeployProgress = { currentStep: '', completedSteps: [] }

    try {
      // 1. Create/update servers (upsert: if a server_id already exists, update it)
      progress.currentStep = 'Creating servers...'
      setDeployProgress({ ...progress })

      const serverTempToDbId = new Map<string, number>()

      // Fetch existing servers once to enable conflict resolution
      const existingServers = await apiCall<NifiServer[]>('nifi/servers/')

      for (const srv of state.servers) {
        if (srv.isExisting && srv.existingId) {
          serverTempToDbId.set(srv.tempId, srv.existingId)
        } else {
          // Check if a server with this server_id already exists
          const conflict = existingServers.find((s) => s.server_id === srv.server_id)
          if (conflict) {
            // Update the existing server with wizard settings and reuse its ID
            await apiCall(`nifi/servers/${conflict.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                server_id: srv.server_id,
                hostname: srv.hostname,
                credential_id: srv.credential_id,
              }),
            })
            serverTempToDbId.set(srv.tempId, conflict.id)
          } else {
            const created = await apiCall<NifiServer>('nifi/servers/', {
              method: 'POST',
              body: JSON.stringify({
                server_id: srv.server_id,
                hostname: srv.hostname,
                credential_id: srv.credential_id,
              }),
            })
            serverTempToDbId.set(srv.tempId, created.id)
          }
        }
      }
      progress.completedSteps.push('Servers created')

      // 2. Create/update instances (upsert by nifi_url)
      progress.currentStep = 'Creating instances...'
      setDeployProgress({ ...progress })

      const instanceTempToDbId = new Map<string, number>()

      const existingInstances = await apiCall<NifiInstance[]>('nifi/instances/')

      for (const inst of state.instances) {
        const serverId = serverTempToDbId.get(inst.serverTempId) ?? null

        let certificateName: string | null = null
        let oidcProviderId: string | null = null
        let username = ''
        let password = ''

        if (inst.authMethod === 'oidc') {
          oidcProviderId = inst.oidcProvider || null
        } else if (inst.authMethod === 'username') {
          username = inst.username
          password = inst.password
        } else if (inst.authMethod === 'certificate') {
          certificateName = inst.certificateName || null
        }

        const instancePayload = {
          name: inst.name || null,
          server_id: serverId,
          nifi_url: inst.nifi_url.replace(/\/+$/, ''),
          username,
          password,
          use_ssl: inst.use_ssl,
          verify_ssl: inst.verify_ssl,
          certificate_name: certificateName,
          oidc_provider_id: oidcProviderId,
          check_hostname: inst.check_hostname,
          git_config_repo_id: inst.git_config_repo_id,
        }

        const conflictInstance = existingInstances.find(
          (i) => i.nifi_url === inst.nifi_url.replace(/\/+$/, '')
        )
        if (conflictInstance) {
          await apiCall(`nifi/instances/${conflictInstance.id}`, {
            method: 'PUT',
            body: JSON.stringify(instancePayload),
          })
          instanceTempToDbId.set(inst.tempId, conflictInstance.id)
        } else {
          const created = await apiCall<NifiInstance>('nifi/instances/', {
            method: 'POST',
            body: JSON.stringify(instancePayload),
          })
          instanceTempToDbId.set(inst.tempId, created.id)
        }
      }
      progress.completedSteps.push('Instances created')

      // 3. Create/update cluster (upsert by cluster_id)
      progress.currentStep = 'Creating cluster...'
      setDeployProgress({ ...progress })

      const members = state.instances.map((inst) => ({
        instance_id: instanceTempToDbId.get(inst.tempId)!,
        is_primary: inst.tempId === state.clusterConfig.primaryInstanceTempId,
      }))

      const clusterPayload = {
        cluster_id: state.clusterConfig.cluster_id,
        hierarchy_attribute: state.clusterConfig.hierarchy_attribute,
        hierarchy_value: state.clusterConfig.hierarchy_value,
        members,
      }

      const existingClusters = await apiCall<NifiCluster[]>('nifi/clusters/')
      const conflictCluster = existingClusters.find(
        (c) => c.cluster_id === state.clusterConfig.cluster_id
      )
      if (conflictCluster) {
        await apiCall(`nifi/clusters/${conflictCluster.id}`, {
          method: 'PUT',
          body: JSON.stringify(clusterPayload),
        })
      } else {
        await apiCall('nifi/clusters/', {
          method: 'POST',
          body: JSON.stringify(clusterPayload),
        })
      }
      progress.completedSteps.push('Cluster created')

      // 4. Write config files to each instance's git repo
      const nodeSubjects = state.certificates.map((c) => c.certSubject)
      const authorizersXml = generateAuthorizersXml(nodeSubjects, state.adminCertSubject)
      const zkProperties = generateZookeeperProperties(state.zookeeperConfig.nodes, {
        quorumPort: state.zookeeperConfig.quorumPort,
        leaderElectionPort: state.zookeeperConfig.leaderElectionPort,
        clientPort: state.zookeeperConfig.clientPort,
      })
      const bootstrapContent = generateBootstrapConf(BOOTSTRAP_TEMPLATE, {
        runAs: state.bootstrapConfig.runAs,
        minRam: state.bootstrapConfig.minRam,
        maxRam: state.bootstrapConfig.maxRam,
        preserveEnvironment: state.bootstrapConfig.preserveEnvironment,
      })

      for (const inst of state.instances) {
        const repoId = inst.git_config_repo_id

        // Ensure static NiFi files (logback.xml, login-identity-providers.xml,
        // state-management.xml) are present in the repo before writing other files
        progress.currentStep = `Checking static files for ${inst.name}...`
        setDeployProgress({ ...progress })

        await apiCall(`nifi/repos/${repoId}/ensure-static-files`, { method: 'POST' })

        // Write bootstrap.conf
        progress.currentStep = `Writing bootstrap.conf for ${inst.name}...`
        setDeployProgress({ ...progress })

        await apiCall(`api/git/${repoId}/file-content`, {
          method: 'PUT',
          body: JSON.stringify({
            path: 'bootstrap.conf',
            content: bootstrapContent,
            commit_message: `[Wizard] Configure bootstrap.conf for ${inst.name}`,
          }),
        })

        // Write authorizers.xml
        progress.currentStep = `Writing authorizers.xml for ${inst.name}...`
        setDeployProgress({ ...progress })

        await apiCall(`api/git/${repoId}/file-content`, {
          method: 'PUT',
          body: JSON.stringify({
            path: 'authorizers.xml',
            content: authorizersXml,
            commit_message: `[Wizard] Configure authorizers.xml for ${inst.name}`,
          }),
        })

        // Write zookeeper.properties
        progress.currentStep = `Writing zookeeper.properties for ${inst.name}...`
        setDeployProgress({ ...progress })

        await apiCall(`api/git/${repoId}/file-content`, {
          method: 'PUT',
          body: JSON.stringify({
            path: 'zookeeper.properties',
            content: zkProperties,
            commit_message: `[Wizard] Configure zookeeper.properties for ${inst.name}`,
          }),
        })

        // Write nifi.properties
        const nifiContent = state.nifiPropertiesContent[inst.tempId]
        if (nifiContent) {
          progress.currentStep = `Writing nifi.properties for ${inst.name}...`
          setDeployProgress({ ...progress })

          await apiCall(`api/git/${repoId}/file-content`, {
            method: 'PUT',
            body: JSON.stringify({
              path: 'nifi.properties',
              content: nifiContent,
              commit_message: `[Wizard] Configure nifi.properties for ${inst.name}`,
            }),
          })
        }
      }
      progress.completedSteps.push('Config files committed')

      // 5. Invalidate caches
      progress.currentStep = 'Finalizing...'
      setDeployProgress({ ...progress })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.nifi.servers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.nifi.instances() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.nifi.clusters() }),
      ])

      progress.currentStep = ''
      progress.completedSteps.push('Done')
      setDeployProgress({ ...progress })
      setDeployStatus('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setDeployProgress({
        ...progress,
        error: message,
      })
      setDeployStatus('error')
    }
  }, [apiCall, queryClient])

  return { deploy }
}
