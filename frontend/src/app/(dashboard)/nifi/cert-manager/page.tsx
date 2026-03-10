import { Metadata } from 'next'
import { CertManagerPage } from '@/components/features/nifi/cert-manager/cert-manager-page'

export const metadata: Metadata = {
  title: 'Certificate Manager - Datenschleuder',
  description: 'Browse, inspect, convert, and manage TLS certificates for NiFi instances',
}

export default function Page() {
  return <CertManagerPage />
}
