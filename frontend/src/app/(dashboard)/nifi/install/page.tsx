import { Metadata } from 'next'
import { NifiInstallPage } from '@/components/features/nifi/install/nifi-install-page'

export const metadata: Metadata = {
  title: 'NiFi Install - Datenschleuder',
  description: 'Check and create process groups for NiFi flow hierarchy paths',
}

export default function Page() {
  return <NifiInstallPage />
}
