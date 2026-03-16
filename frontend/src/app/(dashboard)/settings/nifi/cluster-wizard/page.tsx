import { Metadata } from 'next'
import { ClusterWizardPage } from '@/components/features/settings/nifi/wizard/cluster-wizard-page'

export const metadata: Metadata = {
  title: 'NiFi Cluster Wizard - Datenschleuder',
  description: 'Step-by-step wizard for creating a NiFi cluster',
}

export default function SettingsNifiClusterWizardPage() {
  return <ClusterWizardPage />
}
