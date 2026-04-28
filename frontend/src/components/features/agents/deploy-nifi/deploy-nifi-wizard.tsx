'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { Rocket, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeployNifiStore } from './wizard-store'
import { StepSelectAgent } from './steps/step-select-agent'
import { StepConfigure } from './steps/step-configure'
import { StepReview } from './steps/step-review'
import { StepDeploy } from './steps/step-deploy'
import { cn } from '@/lib/utils'

const STEPS = [
  { label: 'Agent & Config' },
  { label: 'Properties' },
  { label: 'Review File' },
  { label: 'Deploy' },
] as const

export function DeployNifiWizard() {
  const currentStep = useDeployNifiStore((s) => s.currentStep)
  const setCurrentStep = useDeployNifiStore((s) => s.setCurrentStep)
  const isStepValid = useDeployNifiStore((s) => s.isStepValid)
  const generateComposeContent = useDeployNifiStore((s) => s.generateComposeContent)
  const deployStatus = useDeployNifiStore((s) => s.deployStatus)
  const reset = useDeployNifiStore((s) => s.reset)

  // Subscribe to state that influences step validity
  const selectedAgentId = useDeployNifiStore((s) => s.selectedAgentId)
  const targetDirectory = useDeployNifiStore((s) => s.targetDirectory)
  const properties = useDeployNifiStore((s) => s.properties)
  const composeContent = useDeployNifiStore((s) => s.composeContent)

  useEffect(() => {
    return () => {
      if (useDeployNifiStore.getState().deployStatus !== 'deploying') {
        reset()
      }
    }
  }, [reset])

  const canGoNext = useMemo(
    () => isStepValid(currentStep),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStep, isStepValid, selectedAgentId, targetDirectory, properties, composeContent]
  )

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }, [currentStep, setCurrentStep])

  const handleNext = useCallback(() => {
    if (currentStep === 1) {
      // Generate compose content when advancing from properties step
      generateComposeContent()
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep, setCurrentStep, generateComposeContent])

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case 0: return <StepSelectAgent />
      case 1: return <StepConfigure />
      case 2: return <StepReview />
      case 3: return <StepDeploy />
      default: return null
    }
  }, [currentStep])

  const isLastStep = currentStep === STEPS.length - 1

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Rocket className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Deploy NiFi</h1>
            <p className="text-muted-foreground mt-2">
              Configure and deploy a NiFi instance via the agent
            </p>
          </div>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep
          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                    isCompleted
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : isCurrent
                      ? 'bg-white border-blue-500 text-blue-500'
                      : 'bg-white border-gray-200 text-gray-400'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    'text-xs mt-1 font-medium whitespace-nowrap',
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-blue-400' : 'text-gray-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 mb-4',
                    idx < currentStep ? 'bg-blue-400' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      {stepContent}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || deployStatus === 'deploying'}
        >
          Back
        </Button>

        {!isLastStep && (
          <Button onClick={handleNext} disabled={!canGoNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
