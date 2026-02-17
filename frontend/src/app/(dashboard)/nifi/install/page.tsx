import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NiFi Install - Cockpit',
  description: 'Install and manage NiFi instances',
}

export default function NifiInstallPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">NiFi Install</h1>
      <p className="text-slate-500">Coming soon — migration in progress.</p>
    </div>
  )
}
