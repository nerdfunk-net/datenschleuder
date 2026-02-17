'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import {
  Home,
  Zap,
  GitBranch,
  Settings as SettingsIcon
} from 'lucide-react'

export default function DashboardOverview() {
  const user = useAuthStore((state) => state.user)

  const quickLinks = [
    {
      title: 'Jobs',
      description: 'Manage and monitor job templates',
      icon: Zap,
      href: '/jobs',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100'
    },
    {
      title: 'Git Repositories',
      description: 'Manage Git repository connections',
      icon: GitBranch,
      href: '/settings/git',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      iconBg: 'bg-green-100'
    },
    {
      title: 'Settings',
      description: 'Configure application settings',
      icon: SettingsIcon,
      href: '/settings',
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      iconBg: 'bg-slate-100'
    }
  ]

  return (
    <div className="space-y-8 p-6 bg-slate-50/50 min-h-screen">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome{user?.username ? `, ${user.username}` : ''}!
        </h1>
        <p className="text-slate-600">
          Get started with your application scaffold
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickLinks.map((link) => {
          const IconComponent = link.icon
          return (
            <a key={link.title} href={link.href}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer h-full">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl ${link.iconBg}`}>
                      <IconComponent className={`h-6 w-6 ${link.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardTitle className="text-lg font-semibold text-slate-900 mb-2">
                    {link.title}
                  </CardTitle>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {link.description}
                  </p>
                </CardContent>
              </Card>
            </a>
          )
        })}
      </div>

      {/* Getting Started Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Home className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-xl text-slate-900">Getting Started</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-600 leading-relaxed">
              This is a clean application scaffold with the following features:
            </p>
            <ul className="text-slate-600 space-y-2 mt-4">
              <li><strong>Job Management:</strong> Create and schedule automated tasks</li>
              <li><strong>Git Integration:</strong> Connect to Git repositories for version control</li>
              <li><strong>User Management:</strong> Role-based access control (RBAC) with permissions</li>
              <li><strong>Settings:</strong> Configure application behavior and credentials</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              To customize this dashboard, edit the{' '}
              <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                /frontend/src/components/layout/dashboard-overview.tsx
              </code>{' '}
              file.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
