import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Flows Deploy - Cockpit',
  description: 'Deploy NiFi flows to target instances',
}

export default function FlowsDeployPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Flows — Deploy</h1>
      <p className="text-slate-500">Coming soon — migration in progress.</p>
    </div>
  )
}
