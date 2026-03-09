import type { Metadata } from 'next'
import { PKIPage } from '@/components/features/tools/pki/pki-page'

export const metadata: Metadata = {
  title: 'PKI Manager - Datenschleuder',
}

export default function Page() {
  return <PKIPage />
}
