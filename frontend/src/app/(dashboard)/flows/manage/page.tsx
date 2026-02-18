import { Metadata } from 'next'
import { FlowsManagePage } from '@/components/features/flows/manage/flows-manage-page'

export const metadata: Metadata = {
  title: 'Flows Manage - Datenschleuder',
  description: 'Manage NiFi process groups and flows',
}

export default function FlowsManageRoute() {
  return <FlowsManagePage />
}
