import { Metadata } from 'next'
import { HelpPage } from '@/components/features/help/help-page'

export const metadata: Metadata = {
  title: 'Help - Datenschleuder',
  description: 'What Datenschleuder does and how to navigate it',
}

export default function Page() {
  return <HelpPage />
}
