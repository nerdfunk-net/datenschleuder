'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Server, Network, Shield, Settings, Rocket, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWizardStore } from './wizard-store'
import { StepServers } from './steps/step-servers'
import { StepInstances } from './steps/step-instances'
import { StepCluster } from './steps/step-cluster'
import { StepConfigFiles } from './steps/step-config-files'
import { StepReview } from './steps/step-review'

const STEPS = [
  { label: 'Servers', icon: Server },
  { label: 'Instances', icon: Network },
  { label: 'Cluster', icon: Shield },
  { label: 'Config Files', icon: Settings },
  { label: 'Review & Deploy', icon: Rocket },
] as const

export function ClusterWizardPage() {
  const router = useRouter()
  const currentStep = useWizardStore((s) => s.currentStep)
  const setCurrentStep = useWizardStore((s) => s.setCurrentStep)
  const isStepValid = useWizardStore((s) => s.isStepValid)
  const reset = useWizardStore((s) => s.reset)
  const deployStatus = useWizardStore((s) => s.deployStatus)

  useEffect(() => {
    return () => {
      // Reset store on unmount only if not deploying
      const status = useWizardStore.getState().deployStatus
      if (status !== 'deploying') {
        reset()
      }
    }
  }, [reset])

  const handleBack = useCallback(() => {
    if (currentStep === 0) {
      router.push('/settings/nifi')
    } else {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep, router, setCurrentStep])

  const handleNext = useCallback(() => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep, setCurrentStep])

  // Subscribe to relevant state to trigger re-evaluation of step validity
  const servers = useWizardStore((s) => s.servers)
  const instances = useWizardStore((s) => s.instances)
  const clusterConfig = useWizardStore((s) => s.clusterConfig)
  const certificates = useWizardStore((s) => s.certificates)
  const adminCertSubject = useWizardStore((s) => s.adminCertSubject)

  const canGoNext = useMemo(
    () => isStepValid(currentStep),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStep, isStepValid, servers, instances, clusterConfig, certificates, adminCertSubject]
  )

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case 0:
        return <StepServers />
      case 1:
        return <StepInstances />
      case 2:
        return <StepCluster />
      case 3:
        return <StepConfigFiles />
      case 4:
        return <StepReview />
      default:
        return null
    }
  }, [currentStep])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings/nifi')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="bg-blue-100 p-2 rounded-lg">
          <Network className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">NiFi Cluster Wizard</h1>
          <p className="text-muted-foreground mt-1">
            Step-by-step guide to configure a complete NiFi cluster
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <nav className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const isActive = idx === currentStep
          const isCompleted = idx < currentStep
          const isValid = isStepValid(idx)

          return (
            <button
              key={step.label}
              onClick={() => {
                if (idx < currentStep || (idx === currentStep + 1 && isStepValid(currentStep))) {
                  setCurrentStep(idx)
                }
              }}
              disabled={idx > currentStep + 1 || (idx > currentStep && !isStepValid(currentStep))}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
                ${isActive ? 'bg-blue-100 text-blue-700' : ''}
                ${isCompleted && isValid ? 'text-green-700' : ''}
                ${isCompleted && !isValid ? 'text-amber-600' : ''}
                ${!isActive && !isCompleted ? 'text-slate-400' : ''}
                ${idx <= currentStep || (idx === currentStep + 1 && isStepValid(currentStep)) ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed'}
              `}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold
                  ${isActive ? 'bg-blue-600 text-white' : ''}
                  ${isCompleted && isValid ? 'bg-green-600 text-white' : ''}
                  ${isCompleted && !isValid ? 'bg-amber-500 text-white' : ''}
                  ${!isActive && !isCompleted ? 'bg-slate-200 text-slate-500' : ''}
                `}
              >
                {isCompleted && isValid ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className="hidden md:inline">{step.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Step Content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {stepContent}
      </div>

      {/* Navigation */}
      {deployStatus !== 'deploying' && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStep === 0 ? 'Back to Settings' : 'Previous'}
          </Button>
          {currentStep < 4 && (
            <Button onClick={handleNext} disabled={!canGoNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
