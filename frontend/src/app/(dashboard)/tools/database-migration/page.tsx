'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Database, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useDatabaseMigration } from './hooks/use-database-migration'
import { useRbacSeeding } from './hooks/use-rbac-seeding'
import { MigrationSystemInfo } from './components/migration-system-info'
import { SchemaDiffView } from './components/schema-diff-view'
import { MigrationResultReport } from './components/migration-result-report'
import { RbacSeedingSection } from './components/rbac-seeding-section'
import { SeedRbacDialog } from './dialogs/seed-rbac-dialog'
import { SeedOutputModal } from './dialogs/seed-output-modal'

export default function DatabaseMigrationPage() {
  const {
    status,
    appliedMigrations,
    loading,
    error,
    migrating,
    migrationResult,
    refetch,
    handleMigrate,
  } = useDatabaseMigration()

  const {
    showSeedDialog,
    setShowSeedDialog,
    showSeedOutputModal,
    setShowSeedOutputModal,
    removeExisting,
    setRemoveExisting,
    seeding,
    seedResult,
    handleSeedRbac,
  } = useRbacSeeding()

  const onMigrate = () => {
    handleMigrate(undefined, {
      onSuccess: (data) => {
        if (data.success) setShowSeedDialog(true)
      },
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Database Migration</h1>
              <p className="text-gray-500 text-sm">Compare and synchronize database schema</p>
            </div>
          </div>
        </div>

        {/* Migration System Info */}
        {status?.migration_system && (
          <MigrationSystemInfo
            migrationSystem={status.migration_system}
            appliedMigrations={appliedMigrations}
          />
        )}

        {/* Warnings */}
        {status?.warnings && status.warnings.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Important Notes</AlertTitle>
            <AlertDescription className="text-amber-800 space-y-2">
              {status.warnings.map(warning => (
                <p key={warning} className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{warning}</span>
                </p>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Manual Schema Migration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Manual Schema Migration</CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <CardDescription>
              Emergency tool for ad-hoc schema fixes. Prefer creating versioned migrations for
              production.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4 border-red-200 bg-red-50 text-red-900">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : status ? (
              <>
                <SchemaDiffView status={status} migrating={migrating} onMigrate={onMigrate} />
                {migrationResult && <MigrationResultReport result={migrationResult} />}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* RBAC Seeding */}
        <RbacSeedingSection
          seeding={seeding}
          removeExisting={removeExisting}
          onRemoveExistingChange={setRemoveExisting}
          onSeed={handleSeedRbac}
        />

        <SeedRbacDialog
          open={showSeedDialog}
          onOpenChange={setShowSeedDialog}
          onSeed={handleSeedRbac}
        />

        <SeedOutputModal
          open={showSeedOutputModal}
          onOpenChange={setShowSeedOutputModal}
          result={seedResult}
        />
      </div>
    </div>
  )
}
