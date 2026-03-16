'use client'

import { useMemo } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useWizardStore } from '../wizard-store'
import { generateAuthorizersXml } from '../utils/authorizers-generator'

export function AuthorizersTab() {
  const certificates = useWizardStore((s) => s.certificates)
  const adminCertSubject = useWizardStore((s) => s.adminCertSubject)

  const nodeSubjects = useMemo(
    () => certificates.map((c) => c.certSubject).filter((s) => s.length > 0),
    [certificates]
  )

  const allSubjectsProvided = nodeSubjects.length === certificates.length && adminCertSubject.length > 0

  const preview = useMemo(() => {
    if (!allSubjectsProvided) return ''
    return generateAuthorizersXml(nodeSubjects, adminCertSubject)
  }, [nodeSubjects, adminCertSubject, allSubjectsProvided])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-700">Authorizers XML</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-generated from certificate subjects. This file will be identical for all instances in the cluster.
          </p>
        </div>
      </div>

      {!allSubjectsProvided ? (
        <Alert>
          <AlertDescription>
            Please fill in all certificate subjects in the Certificates tab first.
            {certificates.length > 0 && (
              <span>
                {' '}
                ({nodeSubjects.length}/{certificates.length} node subjects provided
                {!adminCertSubject && ', admin subject missing'})
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <pre className="text-xs text-slate-800 overflow-x-auto whitespace-pre">{preview}</pre>
        </div>
      )}
    </div>
  )
}
