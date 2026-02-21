import { Metadata } from 'next'
import { NifiMonitoringPage } from '@/components/features/nifi/monitoring/nifi-monitoring-page'

export const metadata: Metadata = {
  title: 'NiFi Monitoring - Datenschleuder',
  description: 'Monitor NiFi instances and flow status',
}

export default function Page() {
  return <NifiMonitoringPage />
}
