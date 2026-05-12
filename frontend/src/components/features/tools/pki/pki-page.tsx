'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/auth-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="bg-purple-100 p-2 rounded-lg">
            <ShieldAlert className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">PKI Manager</h1>
            <p className="text-muted-foreground mt-2">
              Manage your private Certificate Authority and issue certificates
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="ca" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ca">Certificate Authority</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="test">Test Connection</TabsTrigger>
        </TabsList>
        <TabsContent value="ca" className="space-y-6">
          <CAPanel />
        </TabsContent>
        <TabsContent value="certificates" className="space-y-6">
          <CertificateTable />
        </TabsContent>
        <TabsContent value="test" className="space-y-6">
          <CertificateTestPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
