'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronRight, Search, FileSliders, AlertTriangle, Star } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { useWizardStore } from '../wizard-store'
import { useNifiConfigFileQuery } from '../../hooks/use-nifi-config-query'
import {
  parseNifiProperties,
  groupNifiProperties,
  generateNifiProperties,
} from '../../utils/nifi-properties-parser'
import type { NifiProperty, NifiPropertyGroup } from '../../types'
import type { WizardInstance, WizardServer, CertificateConfig, ZookeeperConfig } from '../types'

// Cycling color palette — matches nifi-properties-dialog
const GROUP_GRADIENTS = [
  'bg-gradient-to-r from-blue-400/80 to-blue-500/80',
  'bg-gradient-to-r from-violet-400/80 to-violet-500/80',
  'bg-gradient-to-r from-emerald-400/80 to-emerald-500/80',
  'bg-gradient-to-r from-orange-400/80 to-orange-500/80',
  'bg-gradient-to-r from-cyan-400/80 to-cyan-500/80',
  'bg-gradient-to-r from-rose-400/80 to-rose-500/80',
  'bg-gradient-to-r from-amber-400/80 to-amber-500/80',
  'bg-gradient-to-r from-indigo-400/80 to-indigo-500/80',
  'bg-gradient-to-r from-teal-400/80 to-teal-500/80',
  'bg-gradient-to-r from-pink-400/80 to-pink-500/80',
  'bg-gradient-to-r from-lime-500/80 to-lime-600/80',
  'bg-gradient-to-r from-sky-400/80 to-sky-500/80',
]
const GROUP_CONTENT_BG = [
  'bg-blue-50/40',
  'bg-violet-50/40',
  'bg-emerald-50/40',
  'bg-orange-50/40',
  'bg-cyan-50/40',
  'bg-rose-50/40',
  'bg-amber-50/40',
  'bg-indigo-50/40',
  'bg-teal-50/40',
  'bg-pink-50/40',
  'bg-lime-50/40',
  'bg-sky-50/40',
]

// The 12 properties shown in the mandatory panel (in order)
const MANDATORY_KEYS = [
  'nifi.web.https.host',
  'nifi.web.https.port',
  'nifi.security.keystore',
  'nifi.security.keystoreType',
  'nifi.security.keystorePasswd',
  'nifi.security.keyPasswd',
  'nifi.security.truststore',
  'nifi.security.truststoreType',
  'nifi.security.truststorePasswd',
  'nifi.sensitive.props.key',
  'nifi.security.user.authorizer',
  'nifi.zookeeper.connect.string',
] as const

const MANDATORY_KEY_SET = new Set<string>(MANDATORY_KEYS)

function buildDefaults(
  server: WizardServer | undefined,
  cert: CertificateConfig | undefined,
  zookeeperConfig: ZookeeperConfig
): Record<string, string> {
  const connectString = zookeeperConfig.nodes
    .map((n) => `${n.hostname}:${zookeeperConfig.clientPort}`)
    .filter((s) => s.startsWith(':') === false)
    .join(',')

  return {
    'nifi.web.https.host': server?.hostname ?? '',
    'nifi.web.https.port': '8443',
    'nifi.security.keystore': './conf/keystore.p12',
    'nifi.security.keystoreType': 'PKCS12',
    'nifi.security.keystorePasswd': cert?.keystorePassword ?? '',
    'nifi.security.keyPasswd': cert?.keystorePassword ?? '',
    'nifi.security.truststore': './conf/truststore.p12',
    'nifi.security.truststoreType': 'PKCS12',
    'nifi.security.truststorePasswd': cert?.truststorePassword ?? '',
    'nifi.sensitive.props.key': '',
    'nifi.security.user.authorizer': 'managed-authorizer',
    'nifi.zookeeper.connect.string': connectString,
  }
}

/**
 * Generate nifi.properties content.
 * - Properties that were in the original file are updated by line number.
 * - Properties with lineNumber === 0 (virtual/new) are appended.
 */
function generateContent(rawContent: string, properties: NifiProperty[]): string {
  const existing = properties.filter((p) => p.lineNumber > 0)
  const newProps = properties.filter((p) => p.lineNumber === 0)

  let result = rawContent ? generateNifiProperties(rawContent, existing) : ''

  if (newProps.length > 0) {
    const appended = newProps.map((p) => `${p.key}=${p.value}`).join('\n')
    result = result
      ? `${result}\n\n# Added by Cluster Wizard\n${appended}`
      : appended
  }

  return result
}

// ────────────────────────────────────────────────────────────────────────────
// InstancePropertiesPanel — handles one instance's nifi.properties
// ────────────────────────────────────────────────────────────────────────────

interface InstancePanelProps {
  instance: WizardInstance
  server: WizardServer | undefined
  cert: CertificateConfig | undefined
  zookeeperConfig: ZookeeperConfig
}

function InstancePropertiesPanel({ instance, server, cert, zookeeperConfig }: InstancePanelProps) {
  const repoId = instance.git_config_repo_id > 0 ? instance.git_config_repo_id : null
  const qk = useMemo(
    () => (repoId != null ? queryKeys.nifi.nifiProperties(repoId) : ['noop']),
    [repoId]
  )

  const setNifiPropertiesContent = useWizardStore((s) => s.setNifiPropertiesContent)
  const savedContent = useWizardStore((s) => s.nifiPropertiesContent[instance.tempId])

  // Skip fetching when the user already has edits in the store for this instance
  const hasSavedContent = !!savedContent

  const { data: rawContent, isLoading, isError } = useNifiConfigFileQuery(
    hasSavedContent ? null : repoId,
    'nifi.properties',
    qk
  )

  // When the repo has no nifi.properties yet (404 / isError), fall back to the
  // fresh template shipped in contributing-data/nifi/nifi.properties.
  const { apiCall } = useApi()
  const { data: freshTemplate, isLoading: isFreshLoading } = useQuery<string>({
    queryKey: ['nifi-fresh-properties'],
    queryFn: () => apiCall<string>('nifi/get-fresh-properties'),
    enabled: isError && repoId != null && !hasSavedContent,
    staleTime: Infinity,
  })

  const defaults = useMemo(
    () => buildDefaults(server, cert, zookeeperConfig),
    [server, cert, zookeeperConfig]
  )

  // Source of truth: NifiProperty[] (same state for both panels)
  const [properties, setProperties] = useState<NifiProperty[]>([])
  // Original raw content for regeneration
  const [originalRaw, setOriginalRaw] = useState('')
  const [filter, setFilter] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  // Track whether we've already initialised from saved/fetched content
  const [initialised, setInitialised] = useState(false)

  // Initialise / re-initialise when file loads (or when fresh template arrives as fallback).
  // If the store already has content for this instance (user edited before switching away),
  // restore from there instead of re-fetching — this preserves edits across tab switches.
  useEffect(() => {
    // If already initialised from saved store content, skip re-initialisation
    // to avoid overwriting user edits when rawContent/freshTemplate arrive later.
    if (initialised && savedContent) return

    const isFromFreshTemplate = !savedContent && !rawContent && !!freshTemplate
    const content = savedContent ?? rawContent ?? freshTemplate ?? ''
    if (!content) return

    setOriginalRaw(content)

    const parsed = parseNifiProperties(content)
    const byKey = new Map(parsed.map((p) => [p.key, p]))

    // Ensure every mandatory key exists in the properties array.
    // If missing from file, create a virtual entry (lineNumber = 0).
    // When loading the fresh template (not a real git file), always apply computed
    // defaults — the template may have placeholder values like "localhost" that
    // must be replaced with the actual wizard values (server hostname, passwords, etc.).
    const mandatoryDefaults = defaults
    const extraProps: NifiProperty[] = []
    for (const key of MANDATORY_KEYS) {
      if (!byKey.has(key)) {
        extraProps.push({
          lineNumber: 0,
          key,
          value: mandatoryDefaults[key] ?? '',
          isComment: false,
        })
      } else {
        const existing = byKey.get(key)!
        // For fresh template: always override with computed defaults (e.g. replace "localhost")
        // For real git file: only fill in empty values
        if ((isFromFreshTemplate || !existing.value) && mandatoryDefaults[key]) {
          byKey.set(key, { ...existing, value: mandatoryDefaults[key] })
        }
      }
    }

    setProperties([...byKey.values(), ...extraProps])
    setInitialised(true)

    if (content) {
      const groups = groupNifiProperties(parsed)
      setOpenGroups(new Set(groups.map((g) => g.prefix)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawContent, freshTemplate, savedContent])

  // Update value by key — used by both mandatory and full panels
  const handleValueChange = useCallback((key: string, newValue: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.key === key ? { ...p, value: newValue } : p))
    )
  }, [])

  const toggleGroup = useCallback((prefix: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(prefix)) next.delete(prefix)
      else next.add(prefix)
      return next
    })
  }, [])

  // Auto-save generated content to the wizard store on every edit.
  // The actual git write happens during the deploy step.
  useEffect(() => {
    if (properties.length === 0) return
    const content = generateContent(originalRaw, properties)
    setNifiPropertiesContent(instance.tempId, content)
  }, [properties, originalRaw, instance.tempId, setNifiPropertiesContent])

  // Mandatory properties (subset of properties array)
  const mandatoryProperties = useMemo(
    () => MANDATORY_KEYS.map((key) => properties.find((p) => p.key === key)).filter(Boolean) as NifiProperty[],
    [properties]
  )

  // Full-file properties for the lower panel (all props including mandatory)
  const groups: NifiPropertyGroup[] = useMemo(
    () => groupNifiProperties(properties.filter((p) => p.lineNumber > 0)),
    [properties]
  )

  const filteredGroups = useMemo(() => {
    if (!filter) return groups
    const lf = filter.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        properties: g.properties.filter(
          (p) => p.key.toLowerCase().includes(lf) || p.value.toLowerCase().includes(lf)
        ),
      }))
      .filter((g) => g.properties.length > 0)
  }, [groups, filter])

  if (repoId == null) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 text-amber-400 mb-2" />
        <p className="text-sm">No git repository configured for this instance.</p>
        <p className="text-xs mt-1">Go back to Step 2 and assign a git config repository.</p>
      </div>
    )
  }

  if (isLoading || (isError && isFreshLoading)) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Fresh template notice ──────────────────────────────────────── */}
      {isError && freshTemplate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-blue-500" />
          <span>
            No <code className="font-mono text-xs">nifi.properties</code> found in this repository.
            Using the default template — review and save to write it to git.
          </span>
        </div>
      )}

      {/* ── Mandatory NiFi Properties ─────────────────────────────────── */}
      <div className="rounded-lg border border-amber-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-amber-400/90 to-orange-400/90 text-white py-2.5 px-4 flex items-center gap-2">
          <Star className="h-4 w-4" />
          <span className="text-sm font-semibold">Mandatory NiFi Properties</span>
          <span className="ml-auto text-xs text-white/80">{mandatoryProperties.length} properties</span>
        </div>
        <div className="bg-amber-50/30">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-slate-500 py-1.5 w-[45%]">Property</TableHead>
                <TableHead className="text-xs text-slate-500 py-1.5">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mandatoryProperties.map((prop) => (
                <TableRow key={prop.key} className="hover:bg-white/60">
                  <TableCell className="text-xs font-mono py-1.5 break-all text-slate-700">
                    {prop.key}
                    {prop.lineNumber === 0 && (
                      <Badge variant="outline" className="ml-2 text-[10px] py-0 text-amber-600 border-amber-300">
                        new
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      value={prop.value}
                      onChange={(e) => handleValueChange(prop.key, e.target.value)}
                      className="h-7 text-xs font-mono bg-white"
                      placeholder={prop.key === 'nifi.sensitive.props.key' ? 'Enter sensitive props key…' : ''}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Full nifi.properties file ──────────────────────────────────── */}
      {!rawContent && !freshTemplate ? (
        <div className="rounded-lg border border-slate-200 p-4 text-center text-sm text-muted-foreground">
          <p className="font-medium text-slate-600">nifi.properties not found in repository</p>
          <p className="text-xs mt-1">The mandatory properties above will be appended when saved.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Search */}
          <div className="shadow-sm border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-slate-400/80 to-slate-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg">
              <Search className="h-4 w-4" />
              <span className="text-sm font-medium">Full nifi.properties</span>
              <span className="text-xs text-slate-200 ml-auto">
                {filteredGroups.reduce((n, g) => n + g.properties.length, 0)} properties shown
              </span>
            </div>
            <div className="p-3 bg-gradient-to-b from-white to-gray-50 rounded-b-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by key or value…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Groups */}
          <div className="space-y-2">
            {filteredGroups.map((group, idx) => {
              const gradientClass = GROUP_GRADIENTS[idx % GROUP_GRADIENTS.length]!
              const contentBgClass = GROUP_CONTENT_BG[idx % GROUP_CONTENT_BG.length]!
              const isOpen = openGroups.has(group.prefix)
              return (
                <Collapsible
                  key={group.prefix}
                  open={isOpen}
                  onOpenChange={() => toggleGroup(group.prefix)}
                >
                  <div className="shadow-sm border-0 p-0 bg-white rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div
                        className={`${gradientClass} text-white py-2 px-4 flex items-center gap-2 ${isOpen ? 'rounded-t-lg' : 'rounded-lg'}`}
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                        />
                        <span className="text-sm font-medium">{group.prefix}</span>
                        {group.properties.some((p) => MANDATORY_KEY_SET.has(p.key)) && (
                          <Star className="h-3 w-3 text-white/70" />
                        )}
                        <span className="text-xs text-white/70 ml-auto">
                          {group.properties.length}{' '}
                          {group.properties.length === 1 ? 'property' : 'properties'}
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className={contentBgClass}>
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-10 text-xs text-slate-400 py-1.5">#</TableHead>
                              <TableHead className="text-xs text-slate-500 py-1.5">Property</TableHead>
                              <TableHead className="text-xs text-slate-500 py-1.5 w-[42%]">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.properties.map((prop) => {
                              // Get the current value from our shared state (keeps sync with mandatory panel)
                              const currentProp = properties.find((p) => p.key === prop.key)
                              const currentValue = currentProp?.value ?? prop.value
                              const isMandatory = MANDATORY_KEY_SET.has(prop.key)
                              return (
                                <TableRow
                                  key={prop.lineNumber}
                                  className={`hover:bg-white/60 ${isMandatory ? 'bg-amber-50/50' : ''}`}
                                >
                                  <TableCell className="text-xs text-slate-400 py-1 w-10">
                                    {prop.lineNumber}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono py-1 break-all text-slate-700">
                                    {prop.key}
                                    {isMandatory && (
                                      <Star className="inline h-2.5 w-2.5 text-amber-400 ml-1 mb-0.5" />
                                    )}
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <Input
                                      value={currentValue}
                                      onChange={(e) => handleValueChange(prop.key, e.target.value)}
                                      className="h-7 text-xs font-mono bg-white"
                                    />
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Deploy note ────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground text-right pt-1">
        Changes are saved automatically and will be written to git when you deploy the cluster.
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// NifiPropertiesTab — instance selector + per-instance panel
// ────────────────────────────────────────────────────────────────────────────

export function NifiPropertiesTab() {
  const instances = useWizardStore((s) => s.instances)
  const servers = useWizardStore((s) => s.servers)
  const certificates = useWizardStore((s) => s.certificates)
  const zookeeperConfig = useWizardStore((s) => s.zookeeperConfig)

  const [selectedTempId, setSelectedTempId] = useState<string>('')

  // Default to first instance
  useEffect(() => {
    if (instances.length > 0 && !selectedTempId) {
      setSelectedTempId(instances[0]!.tempId)
    }
  }, [instances, selectedTempId])

  const selectedInstance = useMemo(
    () => instances.find((i) => i.tempId === selectedTempId),
    [instances, selectedTempId]
  )
  const selectedServer = useMemo(
    () => servers.find((s) => s.tempId === selectedInstance?.serverTempId),
    [servers, selectedInstance]
  )
  const selectedCert = useMemo(
    () => certificates.find((c) => c.instanceTempId === selectedTempId),
    [certificates, selectedTempId]
  )

  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileSliders className="h-12 w-12 text-slate-300 mb-3" />
        <p className="text-sm">No instances configured. Go back to Step 2 to add instances.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-slate-700">NiFi Properties</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure <code className="font-mono">nifi.properties</code> for each instance. Mandatory
          properties are pre-filled with cluster defaults and can be overridden.
        </p>
      </div>

      {/* Instance selector */}
      {instances.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {instances.map((inst) => (
            <button
              key={inst.tempId}
              onClick={() => setSelectedTempId(inst.tempId)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                ${inst.tempId === selectedTempId
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              {inst.name}
            </button>
          ))}
        </div>
      )}

      {/* Per-instance properties panel */}
      {selectedInstance && (
        <InstancePropertiesPanel
          key={selectedTempId}
          instance={selectedInstance}
          server={selectedServer}
          cert={selectedCert}
          zookeeperConfig={zookeeperConfig}
        />
      )}
    </div>
  )
}
