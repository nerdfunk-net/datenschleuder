import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'

interface RbacSeedingSectionProps {
  seeding: boolean
  removeExisting: boolean
  onRemoveExistingChange: (value: boolean) => void
  onSeed: () => void
}

export function RbacSeedingSection({
  seeding,
  removeExisting,
  onRemoveExistingChange,
  onSeed,
}: RbacSeedingSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RBAC System Seeding</CardTitle>
        <CardDescription>
          Initialize or update the Role-Based Access Control system with default permissions and
          roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertTitle>About RBAC Seeding</AlertTitle>
            <AlertDescription className="text-blue-800 space-y-2">
              <p>This process will:</p>
              <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                <li>Create or update all default permissions for system resources</li>
                <li>Create system roles (admin, operator, network_engineer, viewer)</li>
                <li>Assign appropriate permissions to each role</li>
                <li>Migrate any legacy permissions (network.inventory → general.inventory)</li>
              </ul>
              <p className="mt-2 font-medium">
                Safe to run multiple times - existing data will be preserved.
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remove-existing"
                checked={removeExisting}
                onChange={e => onRemoveExistingChange(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                disabled={seeding}
              />
              <label
                htmlFor="remove-existing"
                className="text-sm font-medium text-gray-700 cursor-pointer select-none"
              >
                Remove all existing RBAC data before seeding
              </label>
            </div>

            {removeExisting && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Warning: Destructive Operation</AlertTitle>
                <AlertDescription className="text-red-700 space-y-1">
                  <p className="font-medium">This will permanently delete:</p>
                  <ul className="list-disc list-inside ml-2 text-sm">
                    <li>All user-role assignments</li>
                    <li>All user-permission overrides</li>
                    <li>All roles (including system roles)</li>
                    <li>All permissions</li>
                  </ul>
                  <p className="mt-2 font-medium">
                    Users will need to be reassigned to roles after this operation.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Run this after database changes or when adding new features that require
                permissions.
              </div>
              <Button
                onClick={onSeed}
                disabled={seeding}
                className={removeExisting ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
              >
                {seeding ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {removeExisting ? 'Removing & Reseeding...' : 'Seeding RBAC...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {removeExisting ? 'Remove & Reseed RBAC' : 'Seed RBAC System'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
