'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Button } from '@/components/ui/button'
import { Loader2, ChevronRight, Search, FileSliders, Wand2 } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { useNifiConfigFileQuery } from '../hooks/use-nifi-config-query'
import { useNifiConfigMutations } from '../hooks/use-nifi-config-mutations'
import {
  parseNifiProperties,
  groupNifiProperties,
  generateNifiProperties,
} from '../utils/nifi-properties-parser'
import type { NifiProperty, NifiPropertyGroup } from '../types'
import { UpdateWizardDialog } from './update-wizard-dialog'

// Cycling color palette for group headers — gradient classes from style guide
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

// Light bg variants for the table content area — matched to gradient above
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: number | null
  instanceName: string
}

export function NifiPropertiesDialog({ open, onOpenChange, repoId, instanceName }: Props) {
  const qk = useMemo(
    () => (repoId != null ? queryKeys.nifi.nifiProperties(repoId) : ['noop']),
    [repoId]
  )

  const { data: rawContent, isLoading: isLoadingFile } = useNifiConfigFileQuery(
    open ? repoId : null,
    'nifi.properties',
    qk
  )

  const { writeConfigFile } = useNifiConfigMutations()

  const [properties, setProperties] = useState<NifiProperty[]>([])
  const [filter, setFilter] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    if (!open || !rawContent) return
    const parsed = parseNifiProperties(rawContent)
    setProperties(parsed)
    setFilter('')
    const groups = groupNifiProperties(parsed)
    setOpenGroups(new Set(groups.map((g) => g.prefix)))
  }, [open, rawContent])

  const groups: NifiPropertyGroup[] = useMemo(() => groupNifiProperties(properties), [properties])

  const filteredGroups = useMemo(() => {
    if (!filter) return groups
    const lowerFilter = filter.toLowerCase()
    return groups
      .map((group) => ({
        ...group,
        properties: group.properties.filter(
          (p) =>
            p.key.toLowerCase().includes(lowerFilter) ||
            p.value.toLowerCase().includes(lowerFilter)
        ),
      }))
      .filter((g) => g.properties.length > 0)
  }, [groups, filter])

  const handleValueChange = useCallback((lineNumber: number, newValue: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.lineNumber === lineNumber ? { ...p, value: newValue } : p))
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

  const handleSave = useCallback(async () => {
    if (repoId == null || !rawContent) return
    const updatedContent = generateNifiProperties(rawContent, properties)
    await writeConfigFile.mutateAsync({
      repoId,
      path: 'nifi.properties',
      content: updatedContent,
      commitMessage: `Update nifi.properties for ${instanceName}`,
    })
    setShowConfirm(false)
    onOpenChange(false)
  }, [repoId, rawContent, properties, instanceName, writeConfigFile, onOpenChange])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* !important override to break out of the default max-w-lg DialogContent constraint */}
        <DialogContent
          className="flex flex-col max-h-[90vh]"
          style={{ maxWidth: '90vw', width: '1400px' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileSliders className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">NiFi Properties</div>
                <div className="text-xs text-muted-foreground font-normal">{instanceName}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {isLoadingFile ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Search bar — styled as a gradient section header */}
              <div className="shadow-sm border-0 p-0 bg-white rounded-lg">
                <div className="bg-gradient-to-r from-slate-400/80 to-slate-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg">
                  <Search className="h-4 w-4" />
                  <span className="text-sm font-medium">Filter Properties</span>
                  <span className="text-xs text-slate-200 ml-auto">
                    {filteredGroups.reduce((n, g) => n + g.properties.length, 0)} properties shown
                  </span>
                </div>
                <div className="p-3 bg-gradient-to-b from-white to-gray-50">
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

              {/* Property groups */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                            <span className="text-xs text-white/70 ml-auto">
                              {group.properties.length} {group.properties.length === 1 ? 'property' : 'properties'}
                            </span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className={`${contentBgClass}`}>
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="w-10 text-xs text-slate-400 py-1.5">#</TableHead>
                                  <TableHead className="text-xs text-slate-500 py-1.5">Property</TableHead>
                                  <TableHead className="text-xs text-slate-500 py-1.5 w-[42%]">Value</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.properties.map((prop) => (
                                  <TableRow key={prop.lineNumber} className="hover:bg-white/60">
                                    <TableCell className="text-xs text-slate-400 py-1 w-10">
                                      {prop.lineNumber}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono py-1 break-all text-slate-700">
                                      {prop.key}
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <Input
                                        value={prop.value}
                                        onChange={(e) =>
                                          handleValueChange(prop.lineNumber, e.target.value)
                                        }
                                        className="h-7 text-xs font-mono bg-white"
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )
                })}
              </div>

              <DialogFooter>
                <div className="flex w-full items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWizardOpen(true)}
                    disabled={!rawContent}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Update Wizard
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setShowConfirm(true)}
                      disabled={writeConfigFile.isPending}
                    >
                      {writeConfigFile.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save & Push
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Save</AlertDialogTitle>
            <AlertDialogDescription>
              This will commit and push the updated <strong>nifi.properties</strong> to the git repository.
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>Save & Push</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpdateWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        repoId={repoId}
        instanceName={instanceName}
        currentRawContent={rawContent ?? ''}
      />
    </>
  )
}
