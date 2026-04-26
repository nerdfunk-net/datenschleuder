'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShieldAlert } from 'lucide-react'
import { CAPanel } from './components/ca-panel'
import { CertificateTable } from './components/certificate-table'
import { CertificateTestPanel } from './components/certificate-test-panel'

export function PKIPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => {
    if (isAuthenticated && user && !user.roles.includes('admin')) {
      router.replace('/')
    }
  }, [isAuthenticated, user, router])

  if (!isAuthenticated || !user || !user.roles.includes('admin')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500 text-white shadow-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PKI Manager</h1>
            <p className="text-gray-600 mt-1">
              Manage your private Certificate Authority and issue certificates
            </p>
          </div>
        </div>

        <Tabs defaultValue="ca">
          <TabsList>
            <TabsTrigger value="ca">Certificate Authority</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="test">Test Connection</TabsTrigger>
          </TabsList>
          <TabsContent value="ca" className="mt-4">
            <CAPanel />
          </TabsContent>
          <TabsContent value="certificates" className="mt-4">
            <CertificateTable />
          </TabsContent>
          <TabsContent value="test" className="mt-4">
            <CertificateTestPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
