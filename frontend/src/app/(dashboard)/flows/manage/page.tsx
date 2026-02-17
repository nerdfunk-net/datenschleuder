import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Flows Manage - Cockpit',
  description: 'Manage NiFi process groups and flows',
}

export default function FlowsManagePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Flows — Manage</h1>
      <p className="text-slate-500">Coming soon — migration in progress.</p>
    </div>
  )
}
