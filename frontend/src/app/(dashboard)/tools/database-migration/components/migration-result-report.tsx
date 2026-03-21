import type { MigrationResponse } from '../types/database-migration-types'

interface MigrationResultReportProps {
  result: MigrationResponse
}

export function MigrationResultReport({ result }: MigrationResultReportProps) {
  return (
    <div
      className={`mt-6 p-4 rounded-lg border ${
        result.success ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
      }`}
    >
      <h3
        className={`font-semibold mb-2 ${result.success ? 'text-blue-800' : 'text-red-800'}`}
      >
        {result.message}
      </h3>
      {result.warnings && result.warnings.length > 0 && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded p-3">
          <p className="text-xs font-bold uppercase text-amber-700 mb-1">⚠️ Warnings:</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-amber-800">
            {result.warnings.map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {result.changes.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Changes Applied:</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
            {result.changes.map(change => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      )}
      {result.errors.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase text-red-500 mb-1">Errors:</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-red-700">
            {result.errors.map(err => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
