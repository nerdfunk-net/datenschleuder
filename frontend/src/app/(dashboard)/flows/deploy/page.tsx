import { Metadata } from 'next'
import { DeploymentWizard } from '@/components/features/flows/deploy/deployment-wizard'

export const metadata: Metadata = {
  title: 'Flows Deploy - Datenschleuder',
  description: 'Deploy NiFi flows to target instances',
}

export default function FlowsDeployPage() {
  return <DeploymentWizard />
}
