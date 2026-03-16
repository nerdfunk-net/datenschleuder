import { create } from 'zustand'
import type {
  WizardServer,
  WizardInstance,
  ClusterConfig,
  CertificateConfig,
  ZookeeperConfig,
  BootstrapWizardConfig,
  DeployStatus,
  DeployProgress,
} from './types'

interface WizardState {
  // Navigation
  currentStep: number
  configSubTab: string

  // Step 1: Servers
  servers: WizardServer[]

  // Step 2: Instances
  instances: WizardInstance[]

  // Step 3: Cluster
  clusterConfig: ClusterConfig

  // Step 4a: Certificates
  certificates: CertificateConfig[]
  adminCertSubject: string

  // Step 4b: Bootstrap
  bootstrapConfig: BootstrapWizardConfig

  // Step 4d: ZooKeeper
  zookeeperConfig: ZookeeperConfig

  // Step 4c: NiFi Properties (generated content per instance, written on deploy)
  nifiPropertiesContent: Record<string, string>

  // Deploy
  deployStatus: DeployStatus
  deployProgress: DeployProgress

  // Navigation actions
  setCurrentStep: (step: number) => void
  setConfigSubTab: (tab: string) => void
  goNext: () => void
  goPrev: () => void

  // Server actions
  addServer: (server: WizardServer) => void
  removeServer: (tempId: string) => void

  // Instance actions
  addInstance: (instance: WizardInstance) => void
  updateInstance: (tempId: string, updates: Partial<WizardInstance>) => void
  removeInstance: (tempId: string) => void

  // Cluster actions
  updateClusterConfig: (updates: Partial<ClusterConfig>) => void

  // Certificate actions
  updateCertificate: (instanceTempId: string, updates: Partial<CertificateConfig>) => void
  setAdminCertSubject: (subject: string) => void

  // Bootstrap actions
  updateBootstrapConfig: (updates: Partial<BootstrapWizardConfig>) => void

  // ZooKeeper actions
  updateZookeeperNode: (instanceTempId: string, hostname: string) => void
  updateZookeeperPorts: (ports: Partial<Pick<ZookeeperConfig, 'quorumPort' | 'leaderElectionPort' | 'clientPort'>>) => void

  // NiFi Properties actions
  setNifiPropertiesContent: (instanceTempId: string, content: string) => void

  // Deploy actions
  setDeployStatus: (status: DeployStatus) => void
  setDeployProgress: (progress: DeployProgress) => void

  // Validation
  isStepValid: (step: number) => boolean

  // Sync derived state from instances
  syncCertificatesFromInstances: () => void
  syncZookeeperFromInstances: () => void

  // Reset
  reset: () => void
}

const INITIAL_CLUSTER_CONFIG: ClusterConfig = {
  cluster_id: '',
  hierarchy_attribute: '',
  hierarchy_value: '',
  primaryInstanceTempId: '',
}

const INITIAL_BOOTSTRAP_CONFIG: BootstrapWizardConfig = {
  runAs: '',
  minRam: '1g',
  maxRam: '1g',
  preserveEnvironment: false,
}

const INITIAL_ZOOKEEPER_CONFIG: ZookeeperConfig = {
  nodes: [],
  quorumPort: 2888,
  leaderElectionPort: 3888,
  clientPort: 2181,
}

const INITIAL_DEPLOY_PROGRESS: DeployProgress = {
  currentStep: '',
  completedSteps: [],
}

export const useWizardStore = create<WizardState>((set, get) => ({
  currentStep: 0,
  configSubTab: 'certificates',
  servers: [],
  instances: [],
  clusterConfig: { ...INITIAL_CLUSTER_CONFIG },
  certificates: [],
  adminCertSubject: '',
  bootstrapConfig: { ...INITIAL_BOOTSTRAP_CONFIG },
  zookeeperConfig: { ...INITIAL_ZOOKEEPER_CONFIG },
  nifiPropertiesContent: {},
  deployStatus: 'idle',
  deployProgress: { ...INITIAL_DEPLOY_PROGRESS },

  setCurrentStep: (step) => set({ currentStep: step }),
  setConfigSubTab: (tab) => set({ configSubTab: tab }),
  goNext: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 4) })),
  goPrev: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),

  addServer: (server) => set((s) => ({ servers: [...s.servers, server] })),
  removeServer: (tempId) =>
    set((s) => ({
      servers: s.servers.filter((srv) => srv.tempId !== tempId),
      instances: s.instances.filter((inst) => inst.serverTempId !== tempId),
    })),

  addInstance: (instance) =>
    set((s) => {
      const newInstances = [...s.instances, instance]
      return { instances: newInstances }
    }),
  updateInstance: (tempId, updates) =>
    set((s) => ({
      instances: s.instances.map((inst) =>
        inst.tempId === tempId ? { ...inst, ...updates } : inst
      ),
    })),
  removeInstance: (tempId) =>
    set((s) => ({
      instances: s.instances.filter((inst) => inst.tempId !== tempId),
      certificates: s.certificates.filter((c) => c.instanceTempId !== tempId),
      zookeeperConfig: {
        ...s.zookeeperConfig,
        nodes: s.zookeeperConfig.nodes.filter((n) => n.instanceTempId !== tempId),
      },
      clusterConfig:
        s.clusterConfig.primaryInstanceTempId === tempId
          ? { ...s.clusterConfig, primaryInstanceTempId: '' }
          : s.clusterConfig,
    })),

  updateClusterConfig: (updates) =>
    set((s) => ({ clusterConfig: { ...s.clusterConfig, ...updates } })),

  updateCertificate: (instanceTempId, updates) =>
    set((s) => ({
      certificates: s.certificates.map((c) =>
        c.instanceTempId === instanceTempId ? { ...c, ...updates } : c
      ),
    })),
  setAdminCertSubject: (subject) => set({ adminCertSubject: subject }),

  updateBootstrapConfig: (updates) =>
    set((s) => ({ bootstrapConfig: { ...s.bootstrapConfig, ...updates } })),

  updateZookeeperNode: (instanceTempId, hostname) =>
    set((s) => ({
      zookeeperConfig: {
        ...s.zookeeperConfig,
        nodes: s.zookeeperConfig.nodes.map((n) =>
          n.instanceTempId === instanceTempId ? { ...n, hostname } : n
        ),
      },
    })),
  updateZookeeperPorts: (ports) =>
    set((s) => ({
      zookeeperConfig: { ...s.zookeeperConfig, ...ports },
    })),

  setNifiPropertiesContent: (instanceTempId, content) =>
    set((s) => ({
      nifiPropertiesContent: { ...s.nifiPropertiesContent, [instanceTempId]: content },
    })),

  setDeployStatus: (status) => set({ deployStatus: status }),
  setDeployProgress: (progress) => set({ deployProgress: progress }),

  syncCertificatesFromInstances: () =>
    set((s) => {
      const existing = new Map(s.certificates.map((c) => [c.instanceTempId, c]))
      const newCerts: CertificateConfig[] = s.instances.map((inst) => {
        const prev = existing.get(inst.tempId)
        return prev
          ? { ...prev, instanceName: inst.name }
          : {
              instanceTempId: inst.tempId,
              instanceName: inst.name,
              certSubject: '',
              keystoreExists: null,
              truststoreExists: null,
              keystorePassword: '',
              truststorePassword: '',
            }
      })
      return { certificates: newCerts }
    }),

  syncZookeeperFromInstances: () =>
    set((s) => {
      const existingNodes = new Map(s.zookeeperConfig.nodes.map((n) => [n.instanceTempId, n]))
      const newNodes = s.instances.map((inst) => {
        const prev = existingNodes.get(inst.tempId)
        if (prev) return prev
        const server = s.servers.find((srv) => srv.tempId === inst.serverTempId)
        return {
          instanceTempId: inst.tempId,
          hostname: server?.hostname || '',
        }
      })
      return { zookeeperConfig: { ...s.zookeeperConfig, nodes: newNodes } }
    }),

  isStepValid: (step) => {
    const s = get()
    switch (step) {
      case 0:
        return s.servers.length > 0
      case 1:
        return (
          s.instances.length > 0 &&
          s.instances.every((inst) => inst.git_config_repo_id > 0 && inst.nifi_url && inst.name)
        )
      case 2:
        return (
          s.clusterConfig.cluster_id.length > 0 &&
          s.clusterConfig.hierarchy_attribute.length > 0 &&
          s.clusterConfig.hierarchy_value.length > 0 &&
          s.clusterConfig.primaryInstanceTempId.length > 0
        )
      case 3:
        return (
          s.certificates.every((c) => c.certSubject.length > 0) &&
          s.adminCertSubject.length > 0
        )
      case 4:
        return true
      default:
        return false
    }
  },

  reset: () =>
    set({
      currentStep: 0,
      configSubTab: 'certificates',
      servers: [],
      instances: [],
      clusterConfig: { ...INITIAL_CLUSTER_CONFIG },
      certificates: [],
      adminCertSubject: '',
      bootstrapConfig: { ...INITIAL_BOOTSTRAP_CONFIG },
      zookeeperConfig: { ...INITIAL_ZOOKEEPER_CONFIG },
      nifiPropertiesContent: {},
      deployStatus: 'idle',
      deployProgress: { ...INITIAL_DEPLOY_PROGRESS },
    }),
}))
