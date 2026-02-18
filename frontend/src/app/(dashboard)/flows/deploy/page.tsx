import { Metadata } from 'next'
import { DeploymentWizard } from '@/components/features/flows/deploy/deployment-wizard'

export const metadata: Metadata = {
  title: 'Flows Deploy - Datenschleuder',
  description: 'Deploy NiFi flows to target instances',
}

export default function FlowsDeployPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Deploy Flows</h1>
        <p className="text-slate-500">
          Deploy NiFi flows to source and/or destination instances using this step-by-step
          wizard
        </p>
      </div>
      <DeploymentWizard />
    </div>
  )
}
