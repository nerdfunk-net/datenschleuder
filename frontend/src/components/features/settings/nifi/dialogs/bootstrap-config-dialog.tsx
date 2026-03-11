'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Settings2, MemoryStick, User } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { useNifiConfigFileQuery } from '../hooks/use-nifi-config-query'
import { useNifiConfigMutations } from '../hooks/use-nifi-config-mutations'
import { parseBootstrapConf, generateBootstrapConf } from '../utils/bootstrap-parser'

const schema = z.object({
  runAs: z.string(),
  minRam: z.string().min(1, 'Required'),
  maxRam: z.string().min(1, 'Required'),
  preserveEnvironment: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: number | null
  serverName: string
}

export function BootstrapConfigDialog({ open, onOpenChange, repoId, serverName }: Props) {
  const qk = useMemo(
    () => (repoId != null ? queryKeys.nifi.bootstrapConfig(repoId) : ['noop']),
    [repoId]
  )

  const { data: rawContent, isLoading: isLoadingFile } = useNifiConfigFileQuery(
    open ? repoId : null,
    'bootstrap.conf',
    qk
  )

  const { writeConfigFile } = useNifiConfigMutations()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { runAs: '', minRam: '1g', maxRam: '1g', preserveEnvironment: false },
  })

  useEffect(() => {
    if (!open || !rawContent) return
    const config = parseBootstrapConf(rawContent)
    form.reset({
      runAs: config.runAs,
      minRam: config.minRam,
      maxRam: config.maxRam,
      preserveEnvironment: config.preserveEnvironment,
    })
  }, [open, rawContent, form])

  const onSubmit = async (values: FormValues) => {
    if (repoId == null || !rawContent) return
    const updatedContent = generateBootstrapConf(rawContent, {
      runAs: values.runAs,
      minRam: values.minRam,
      maxRam: values.maxRam,
      preserveEnvironment: values.preserveEnvironment,
    })
    await writeConfigFile.mutateAsync({
      repoId,
      path: 'bootstrap.conf',
      content: updatedContent,
      commitMessage: `Update bootstrap.conf for ${serverName}`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Settings2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">Bootstrap Configuration</div>
              <div className="text-xs text-muted-foreground font-normal">{serverName}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoadingFile ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* ── JVM Memory ── */}
              <div className="shadow-sm border-0 p-0 bg-white rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg">
                  <MemoryStick className="h-4 w-4" />
                  <span className="text-sm font-medium">JVM Memory</span>
                </div>
                <div className="p-4 space-y-4 bg-gradient-to-b from-white to-slate-50">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="minRam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min RAM <span className="text-slate-400 font-normal">(Xms)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 1g" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxRam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max RAM <span className="text-slate-400 font-normal">(Xmx)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 1g" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* ── Runtime ── */}
              <div className="shadow-sm border-0 p-0 bg-white rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-violet-400/80 to-violet-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">Runtime</span>
                </div>
                <div className="p-4 space-y-4 bg-gradient-to-b from-white to-slate-50">
                  <FormField
                    control={form.control}
                    name="runAs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Run As <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. nifi" {...field} />
                        </FormControl>
                        <FormDescription>Username to run NiFi as (ignored on Windows)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="preserveEnvironment"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Preserve shell environment</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={writeConfigFile.isPending}>
                  {writeConfigFile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save & Push
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
