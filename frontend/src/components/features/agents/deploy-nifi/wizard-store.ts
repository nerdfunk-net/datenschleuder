import { create } from 'zustand'
import {
  DOCKER_COMPOSE_TEMPLATE,
  INITIAL_PROPERTIES,
  REQUIRED_PROPERTIES,
} from './constants'
import type { DeployNifiState, NifiProperties } from './types'

interface DeployNifiActions {
  setCurrentStep: (step: number) => void
  setAgentId: (id: string | null) => void
  setGitRepo: (id: number | null, url: string | null, branch: string, name: string | null) => void
  setCredential: (id: number | null, name: string | null) => void
  setTargetDirectory: (dir: string) => void
  setProperty: (key: string, value: string) => void
  setProperties: (props: NifiProperties) => void
  setComposeContent: (content: string) => void
  generateComposeContent: () => void
  setCreateDirectories: (val: boolean) => void
  setDeployStatus: (status: DeployNifiState['deployStatus']) => void
  setDeployResult: (result: string | null) => void
  setDeployError: (error: string | null) => void
  isStepValid: (step: number) => boolean
  reset: () => void
}

const INITIAL_STATE: DeployNifiState = {
  currentStep: 0,
  selectedAgentId: null,
  selectedGitRepoId: null,
  selectedGitRepoUrl: null,
  selectedGitRepoBranch: 'main',
  selectedGitRepoName: null,
  selectedCredentialId: null,
  selectedCredentialName: null,
  targetDirectory: '',
  properties: { ...INITIAL_PROPERTIES },
  composeContent: '',
  createDirectories: false,
  deployStatus: 'idle',
  deployResult: null,
  deployError: null,
}

export const useDeployNifiStore = create<DeployNifiState & DeployNifiActions>((set, get) => ({
  ...INITIAL_STATE,

  setCurrentStep: (step) => set({ currentStep: step }),

  setAgentId: (id) => set({ selectedAgentId: id }),

  setGitRepo: (id, url, branch, name) =>
    set({
      selectedGitRepoId: id,
      selectedGitRepoUrl: url,
      selectedGitRepoBranch: branch,
      selectedGitRepoName: name,
    }),

  setCredential: (id, name) =>
    set({ selectedCredentialId: id, selectedCredentialName: name }),

  setTargetDirectory: (dir) => set({ targetDirectory: dir }),

  setProperty: (key, value) =>
    set((state) => ({ properties: { ...state.properties, [key]: value } })),

  setProperties: (props) => set({ properties: props }),

  setComposeContent: (content) => set({ composeContent: content }),

  generateComposeContent: () => {
    const { properties } = get()
    let content = DOCKER_COMPOSE_TEMPLATE
    for (const [key, value] of Object.entries(properties)) {
      const placeholder = new RegExp(`__${key}__`, 'g')
      content = content.replace(placeholder, value)
    }
    set({ composeContent: content })
  },

  setCreateDirectories: (val) => set({ createDirectories: val }),

  setDeployStatus: (status) => set({ deployStatus: status }),

  setDeployResult: (result) => set({ deployResult: result }),

  setDeployError: (error) => set({ deployError: error }),

  isStepValid: (step) => {
    const state = get()
    switch (step) {
      case 0:
        return !!state.selectedAgentId
      case 1:
        return (
          !!state.targetDirectory.trim() &&
          REQUIRED_PROPERTIES.every((k) => !!state.properties[k]?.trim())
        )
      case 2:
        return !!state.composeContent.trim()
      case 3:
        return true
      default:
        return false
    }
  },

  reset: () => set({ ...INITIAL_STATE, properties: { ...INITIAL_PROPERTIES } }),
}))
