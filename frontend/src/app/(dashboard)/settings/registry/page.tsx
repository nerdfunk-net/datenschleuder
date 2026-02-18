import { Metadata } from 'next'
import { RegistryFlowsPage } from '@/components/features/settings/registry/registry-flows-page'

export const metadata: Metadata = {
  title: 'Registry Settings - Datenschleuder',
  description: 'Manage NiFi Registry flow references',
}

export default function SettingsRegistryPage() {
  return <RegistryFlowsPage />
}
