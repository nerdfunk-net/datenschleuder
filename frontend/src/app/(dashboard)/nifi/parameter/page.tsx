import { Metadata } from 'next'
import { NifiParametersPage } from '@/components/features/nifi/parameters/nifi-parameters-page'

export const metadata: Metadata = {
  title: 'NiFi Parameter Contexts - Datenschleuder',
  description: 'Manage NiFi parameter contexts across all instances',
}

export default function Page() {
  return <NifiParametersPage />
}
