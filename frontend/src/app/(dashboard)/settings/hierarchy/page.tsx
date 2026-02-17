import { Metadata } from 'next'
import { HierarchySettingsPage } from '@/components/features/settings/hierarchy/hierarchy-settings-page'

export const metadata: Metadata = {
  title: 'Hierarchy Settings - Cockpit',
  description: 'Configure process group hierarchy and structure',
}

export default function SettingsHierarchyPage() {
  return <HierarchySettingsPage />
}
