'use client'

import {
  HelpCircle,
  Home,
  Activity,
  SlidersHorizontal,
  HardDrive,
  ShieldCheck,
  Network,
  Upload,
  Download,
  Server,
  GitFork,
  Layers,
  Rocket,
  GitBranch,
  Key,
  Shield,
  FileText,
  Calendar,
  History,
  Database,
  AlertCircle,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface SectionItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

interface HelpSection {
  title: string
  summary: string
  headerIcon: React.ComponentType<{ className?: string }>
  gradient: string
  helperTextColor: string
  items: SectionItem[]
}

const sections: HelpSection[] = [
  {
    title: 'General',
    summary: 'Starting point — live overview of all monitored job health.',
    headerIcon: Home,
    gradient: 'from-blue-400/80 to-blue-500/80',
    helperTextColor: 'text-blue-100',
    items: [
      {
        label: 'Home',
        href: '/',
        icon: Home,
        description:
          'The main dashboard. Shows a status card for every job template that has been executed at least once — green means healthy, yellow means in progress, red means failed. Cards auto-refresh while jobs are active so you always see the current state without reloading.',
      },
    ],
  },
  {
    title: 'NiFi',
    summary: 'Operate instances and clusters: monitoring, configuration, certs, and initial deployment.',
    headerIcon: Activity,
    gradient: 'from-blue-400/80 to-blue-500/80',
    helperTextColor: 'text-blue-100',
    items: [
      {
        label: 'Monitoring',
        href: '/nifi/monitoring',
        icon: Activity,
        description:
          'Real-time view of your NiFi environment split across three tabs — Instances (health and system diagnostics per node), Flows (process-group status across the canvas), and Queues (backpressure and throughput metrics). Use this page to spot problems before they escalate.',
      },
      {
        label: 'Parameter',
        href: '/nifi/parameter',
        icon: SlidersHorizontal,
        description:
          'Create, edit, copy, and delete NiFi parameter contexts across all connected instances. Parameter contexts let you inject environment-specific values (database URLs, credentials, paths) into flows without touching the flow definition itself.',
      },
      {
        label: 'Install',
        href: '/nifi/install',
        icon: HardDrive,
        description:
          'Compares the expected flow hierarchy against what is actually deployed and surfaces missing process-group paths. For each gap you can trigger a one-click install that creates the missing process group on the target cluster — useful when bootstrapping a fresh NiFi environment or after a hierarchy change.',
      },
      {
        label: 'Cert Manager',
        href: '/nifi/cert-manager',
        icon: ShieldCheck,
        description:
          'Browse keystores and truststores on any NiFi instance, inspect individual certificates (subject, issuer, validity, SANs), and push certificate updates. Keeps TLS configuration in sync without SSH access to the nodes.',
      },
    ],
  },
  {
    title: 'Flows',
    summary: 'Full lifecycle for NiFi flow definitions: maintain the catalogue, push to clusters, pull from registry.',
    headerIcon: Network,
    gradient: 'from-blue-400/80 to-blue-500/80',
    helperTextColor: 'text-blue-100',
    items: [
      {
        label: 'Manage',
        href: '/flows/manage',
        icon: Network,
        description:
          'The central flow catalogue. Lists every flow known to the system with filterable, sortable columns. From here you can create new flow records, edit metadata, save custom views (named filter/column combinations), and trigger a quick deploy to a cluster without leaving the page.',
      },
      {
        label: 'Deploy',
        href: '/flows/deploy',
        icon: Upload,
        description:
          'A step-by-step deployment wizard. Select a flow, choose the target NiFi cluster, resolve any conflicts between what is in the registry and what is running, and confirm. The wizard guides you through parameter context binding and hierarchy placement before committing the change.',
      },
      {
        label: 'Import',
        href: '/flows/import',
        icon: Download,
        description:
          'Pull flow definitions from a connected NiFi Flow Registry into the local catalogue. Use this to onboard flows that were created or versioned directly in the registry rather than through Datenschleuder.',
      },
    ],
  },
  {
    title: 'Agents',
    summary: 'Visibility into Cockpit agent processes running alongside your NiFi nodes.',
    headerIcon: Server,
    gradient: 'from-orange-400/80 to-orange-500/80',
    helperTextColor: 'text-orange-100',
    items: [
      {
        label: 'Operating',
        href: '/agents/operating',
        icon: Activity,
        description:
          'Shows every registered Cockpit agent with its online/offline status, capabilities, and last heartbeat. You can retrieve live stats, execute ad-hoc commands against a specific agent, and browse command history — all without leaving the browser.',
      },
    ],
  },
  {
    title: 'Jobs',
    summary: 'Automate recurring NiFi operations: define templates, schedule them, and audit every run.',
    headerIcon: Calendar,
    gradient: 'from-blue-400/80 to-blue-500/80',
    helperTextColor: 'text-blue-100',
    items: [
      {
        label: 'Job Templates',
        href: '/jobs/templates',
        icon: FileText,
        description:
          'Define reusable job blueprints — the task type, target cluster, parameters, and configuration. Templates are the building blocks for scheduled and on-demand automation (health checks, queue purges, flow validations, and more).',
      },
      {
        label: 'Scheduler',
        href: '/jobs/scheduler',
        icon: Calendar,
        description:
          'Attach cron expressions to job templates to create scheduled runs. Manage all active schedules from one place — enable, disable, or delete them without touching the underlying template.',
      },
      {
        label: 'View',
        href: '/jobs/view',
        icon: History,
        description:
          'Full audit log of every job execution. Filter by template name, status, or time range to trace failures, compare run durations, and inspect the detailed result payload returned by each job.',
      },
    ],
  },
  {
    title: 'Settings',
    summary: 'System-wide configuration. Requires settings:read permission.',
    headerIcon: SlidersHorizontal,
    gradient: 'from-purple-400/80 to-purple-500/80',
    helperTextColor: 'text-purple-100',
    items: [
      {
        label: 'NiFi',
        href: '/settings/nifi',
        icon: Server,
        description:
          'Register and configure NiFi instances and clusters — connection URLs, authentication, cluster membership, and the nifi.properties file. This is the foundational configuration that the rest of the application reads from.',
      },
      {
        label: 'Registry',
        href: '/settings/registry',
        icon: GitFork,
        description:
          'Connect one or more NiFi Flow Registry instances. Datenschleuder uses these connections to read versioned flow definitions and to push new versions during deployments.',
      },
      {
        label: 'Hierarchy',
        href: '/settings/hierarchy',
        icon: Layers,
        description:
          'Define the process-group hierarchy model — the tree of path segments that determines where flows land on the NiFi canvas. The hierarchy drives the Install page gap analysis and the Deploy wizard placement logic.',
      },
      {
        label: 'Deploy',
        href: '/settings/deploy',
        icon: Rocket,
        description:
          'Global deployment defaults: which registry bucket to use, default parameter context bindings, conflict resolution policy, and other options that apply whenever a flow is pushed to a cluster.',
      },
      {
        label: 'Git Management',
        href: '/settings/git',
        icon: GitBranch,
        description:
          'Connect Git repositories that store Ansible playbooks, Jinja templates, or other artefacts consumed by job templates. Supports SSH and HTTPS auth, branch selection, and manual sync.',
      },
      {
        label: 'Celery',
        href: '/settings/celery',
        icon: Server,
        description:
          'Configure the Celery task queue that runs background jobs — broker URL, result backend, concurrency, and queue routing. Changes here affect how quickly scheduled and on-demand jobs are picked up.',
      },
      {
        label: 'Redis',
        href: '/settings/redis',
        icon: Database,
        description:
          'Redis connection settings used as the Celery broker and result store. Set host, port, password, and database index.',
      },
      {
        label: 'Credentials',
        href: '/settings/credentials',
        icon: Key,
        description:
          'Securely store named credentials (username/password pairs, tokens, SNMP community strings) that job templates reference at runtime. Credentials are never exposed in plaintext after initial entry.',
      },
      {
        label: 'Users & Permissions',
        href: '/settings/permissions',
        icon: Shield,
        description:
          'Manage local user accounts and role-based access control. Create roles, assign fine-grained permissions (e.g. flows:write, settings:read), and attach roles to users. OIDC/SSO users are also visible here once they have logged in for the first time.',
      },
    ],
  },
]

export function HelpPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <HelpCircle className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Help</h1>
            <p className="text-gray-600 mt-1">What Datenschleuder does and how to navigate it</p>
          </div>
        </div>
      </div>

      {/* App overview */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Datenschleuder</strong> is a browser-based management dashboard for Apache NiFi
          environments. It gives platform and operations teams a single place to monitor running
          instances, manage flow definitions across clusters, automate recurring tasks, and control
          access — without needing direct SSH or NiFi UI access for everyday work. The sidebar
          organises everything into six areas:{' '}
          <strong>General</strong>, <strong>NiFi</strong>, <strong>Flows</strong>,{' '}
          <strong>Agents</strong>, <strong>Jobs</strong>, and <strong>Settings</strong>.
        </AlertDescription>
      </Alert>

      {/* One gradient panel per sidebar section */}
      {sections.map((section) => {
        const HeaderIcon = section.headerIcon
        return (
          <div key={section.title} className="shadow-lg border-0 p-0 bg-white rounded-lg">
            {/* Gradient header */}
            <div
              className={`bg-gradient-to-r ${section.gradient} text-white py-2 px-4 flex items-center justify-between rounded-t-lg`}
            >
              <div className="flex items-center space-x-2">
                <HeaderIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{section.title}</span>
              </div>
              <div className={`text-xs ${section.helperTextColor}`}>{section.summary}</div>
            </div>

            {/* Content */}
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
              <div className="divide-y divide-gray-100">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.href} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="bg-blue-100 p-1.5 rounded-md h-fit shrink-0">
                        <Icon className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{item.label}</span>
                          <Badge
                            variant="outline"
                            className="text-xs font-mono text-gray-400 border-gray-200"
                          >
                            {item.href}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
