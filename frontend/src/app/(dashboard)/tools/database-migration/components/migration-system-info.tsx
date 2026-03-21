import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Database, AlertTriangle } from 'lucide-react'
import type { MigrationSystemInfo as MigrationSystemInfoType, AppliedMigration } from '../types/database-migration-types'

interface MigrationSystemInfoProps {
  migrationSystem: MigrationSystemInfoType
  appliedMigrations: AppliedMigration[]
}

export function MigrationSystemInfo({ migrationSystem, appliedMigrations }: MigrationSystemInfoProps) {
  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            Versioned Migration System
          </CardTitle>
          <Badge variant={migrationSystem.active ? 'default' : 'secondary'}>
            {migrationSystem.active ? 'Active' : 'Not Initialized'}
          </Badge>
        </div>
        <CardDescription>Automatic migrations that run on application startup</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {migrationSystem.active ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-sm text-gray-500">Applied Migrations</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {migrationSystem.applied_migrations_count}
                  </div>
                </div>
                {migrationSystem.last_migration && (
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-sm text-gray-500">Last Migration</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {migrationSystem.last_migration.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(migrationSystem.last_migration.applied_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              {appliedMigrations.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Migration History</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Migration</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appliedMigrations.map(migration => (
                          <TableRow key={migration.name}>
                            <TableCell className="font-mono text-sm">{migration.name}</TableCell>
                            <TableCell className="text-sm">{migration.description}</TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {new Date(migration.applied_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500 text-right">
                              {migration.execution_time_ms}ms
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Migration System Not Initialized</AlertTitle>
              <AlertDescription className="text-amber-800">
                The versioned migration system hasn&apos;t been set up yet. It will be initialized on
                the next application restart.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
