import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Database, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import type { SchemaStatus } from '../types/database-migration-types'

interface SchemaDiffViewProps {
  status: SchemaStatus
  migrating: boolean
  onMigrate: () => void
}

export function SchemaDiffView({ status, migrating, onMigrate }: SchemaDiffViewProps) {
  return (
    <div className="space-y-6">
      <div
        className={`p-4 rounded-lg flex items-center gap-3 ${
          status.is_up_to_date
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}
      >
        {status.is_up_to_date ? (
          <CheckCircle className="w-6 h-6" />
        ) : (
          <AlertTriangle className="w-6 h-6" />
        )}
        <div>
          <p className="font-semibold text-lg">
            {status.is_up_to_date ? 'Database is up to date' : 'Schema differences detected'}
          </p>
          <p className="text-sm opacity-90">
            {status.is_up_to_date
              ? 'All tables and columns match the application definition.'
              : `${status.missing_tables.length} missing tables and ${status.missing_columns.length} missing columns found.`}
          </p>
        </div>
      </div>

      {!status.is_up_to_date && (
        <div className="space-y-6">
          {status.missing_tables.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Missing Tables ({status.missing_tables.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {status.missing_tables.map(table => (
                  <div
                    key={table}
                    className="bg-white border rounded px-3 py-2 text-sm font-mono text-gray-600 shadow-sm"
                  >
                    {table}
                  </div>
                ))}
              </div>
            </div>
          )}

          {status.missing_columns.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Missing Columns ({status.missing_columns.length})
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Table</TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.missing_columns.map(col => (
                      <TableRow key={`${col.table}-${col.column}`}>
                        <TableCell className="font-medium">{col.table}</TableCell>
                        <TableCell className="font-mono text-blue-600">{col.column}</TableCell>
                        <TableCell className="text-gray-500">{col.type}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {col.nullable ? (
                            <Badge variant="outline">Nullable</Badge>
                          ) : (
                            <Badge variant="secondary">Required</Badge>
                          )}
                          {col.default && <span className="ml-2">Default: {col.default}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end">
            <Button
              onClick={onMigrate}
              disabled={migrating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {migrating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Applying Changes...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Update Database Structure
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
