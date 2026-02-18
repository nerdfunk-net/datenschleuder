'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Loader2 } from 'lucide-react'
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form'
import { useCacheSettings } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'
import type { CacheSettings } from '../types'
import { useEffect } from 'react'

const cacheSettingsSchema = z.object({
  enabled: z.boolean(),
  ttl_seconds: z.number().min(30).max(86400),
})

type CacheSettingsFormData = z.infer<typeof cacheSettingsSchema>

export function CacheSettingsForm() {
  const { data: settings, isLoading } = useCacheSettings()
  const { saveSettings } = useCacheMutations()

  const form = useForm<CacheSettingsFormData>({
    resolver: zodResolver(cacheSettingsSchema),
    defaultValues: {
      enabled: true,
      ttl_seconds: 600,
    },
  })

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        enabled: settings.enabled,
        ttl_seconds: settings.ttl_seconds,
      })
    }
  }, [settings, form])

  const handleSubmit = form.handleSubmit((data) => {
    // Send only the two fields, backend will handle defaults for others
    saveSettings.mutate(data as CacheSettings)
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cache Configuration</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cache Configuration</CardTitle>
        <CardDescription>
          Configure basic cache settings for your application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable Cache */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Cache</FormLabel>
                    <FormDescription>
                      Turn caching on or off globally
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* TTL */}
            <FormField
              control={form.control}
              name="ttl_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TTL (Time To Live) - Seconds</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={30}
                      max={86400}
                      step={30}
                      placeholder="600"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 600)}
                    />
                  </FormControl>
                  <FormDescription>
                    How long to keep cached items before they expire (30 seconds - 24 hours)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={saveSettings.isPending || !form.formState.isDirty}
              className="w-full sm:w-auto"
            >
              {saveSettings.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
