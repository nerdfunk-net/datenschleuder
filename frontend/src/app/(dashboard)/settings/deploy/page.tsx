import { Metadata } from 'next'
import { DeploySettingsPage } from '@/components/features/settings/deploy/deploy-settings-page'

export const metadata: Metadata = {
  title: 'Deploy Settings - Datenschleuder',
  description: 'Configure deployment targets and options',
}

export default function SettingsDeployPage() {
  return <DeploySettingsPage />
}
