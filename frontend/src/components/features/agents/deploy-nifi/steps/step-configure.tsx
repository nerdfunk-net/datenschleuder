'use client'

import { useCallback } from 'react'
import { Settings, FolderOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeployNifiStore } from '../wizard-store'
import { PROPERTY_GROUPS } from '../constants'

export function StepConfigure() {
  const targetDirectory = useDeployNifiStore((s) => s.targetDirectory)
  const properties = useDeployNifiStore((s) => s.properties)
  const setTargetDirectory = useDeployNifiStore((s) => s.setTargetDirectory)
  const setProperty = useDeployNifiStore((s) => s.setProperty)

  const handleTargetDir = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTargetDirectory(e.target.value),
    [setTargetDirectory]
  )

  const handlePropChange = useCallback(
    (key: string, value: string) => setProperty(key, value),
    [setProperty]
  )

  return (
    <div className="space-y-6">
      {/* Target directory */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
          <FolderOpen className="h-4 w-4" />
          <span className="text-sm font-medium">Deployment Target</span>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-2">
          <Label htmlFor="target-dir" className="text-sm">
            Target Directory <span className="text-red-500">*</span>
          </Label>
          <Input
            id="target-dir"
            placeholder="/opt/nifi"
            value={targetDirectory}
            onChange={handleTargetDir}
          />
          <p className="text-xs text-gray-500">
            Absolute path on the agent host where <code className="font-mono">docker-compose.yml</code> will
            be written. Volume directory paths are relative to this location.
          </p>
        </div>
      </div>

      {/* Property groups */}
      {PROPERTY_GROUPS.map((group) => (
        <div key={group.title} className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center space-x-2 rounded-t-lg">
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">{group.title}</span>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {group.properties.map((key) => (
                  <tr key={key}>
                    <td className="py-2 pr-4 w-64 align-middle">
                      <span className="font-mono text-sm text-gray-700">{key}</span>
                    </td>
                    <td className="py-2 align-middle">
                      <Input
                        value={properties[key] ?? ''}
                        onChange={(e) => handlePropChange(key, e.target.value)}
                        placeholder={`Enter ${key}`}
                        className="h-8 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
