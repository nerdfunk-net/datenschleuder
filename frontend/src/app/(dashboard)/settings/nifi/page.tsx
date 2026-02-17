import { Metadata } from 'next'
import { NifiInstancesPage } from '@/components/features/settings/nifi/nifi-instances-page'

export const metadata: Metadata = {
  title: 'NiFi Settings - Cockpit',
  description: 'Configure NiFi connection and settings',
}

export default function SettingsNifiPage() {
  return <NifiInstancesPage />
}
