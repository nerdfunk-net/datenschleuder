'use client'

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
import { useCertManagerMutations } from '../hooks/use-cert-manager-mutations'
import type { CertificateInfo } from '../types'

interface RemoveCertificateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
  filePath: string
  certIndices: number[]
  filePassword: string
  selectedCertificates: CertificateInfo[]
}

export function RemoveCertificateDialog({
  open,
  onOpenChange,
  instanceId,
  filePath,
  certIndices,
  filePassword,
  selectedCertificates,
}: RemoveCertificateDialogProps) {
  const { removeCertificates } = useCertManagerMutations()

  function handleConfirm() {
    removeCertificates.mutate(
      {
        instance_id: instanceId,
        file_path: filePath,
        cert_indices: certIndices,
        password: filePassword || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Certificate{certIndices.length > 1 ? 's' : ''}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                The following {certIndices.length === 1 ? 'certificate' : `${certIndices.length} certificates`} will be
                permanently removed from <span className="font-mono text-xs">{filePath}</span> and the change will be
                committed to git:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {selectedCertificates.map((cert) => (
                  <li key={cert.index} className="text-sm font-mono">
                    {cert.subject}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={removeCertificates.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {removeCertificates.isPending ? 'Removing…' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
