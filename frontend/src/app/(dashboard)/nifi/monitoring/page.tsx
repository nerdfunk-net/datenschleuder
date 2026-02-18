import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NiFi Monitoring - Datenschleuder',
  description: 'Monitor NiFi instances and flow status',
}

export default function NifiMonitoringPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">NiFi Monitoring</h1>
      <p className="text-slate-500">Coming soon — migration in progress.</p>
    </div>
  )
}
