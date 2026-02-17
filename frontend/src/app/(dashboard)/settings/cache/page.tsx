import { Metadata } from 'next'
import CacheManagement from '@/components/features/settings/cache/cache-management'

export const metadata: Metadata = {
  title: 'Cache Settings - Scaffold',
  description: 'Configure cache settings',
}

export default function CacheSettingsPage() {
  return <CacheManagement />
}
