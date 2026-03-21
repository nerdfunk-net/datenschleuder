import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { SeedRbacResponse } from '../types/database-migration-types'

interface SeedOutputModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SeedRbacResponse | null
}

export function SeedOutputModal({ open, onOpenChange, result }: SeedOutputModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {result?.success ? '✅ RBAC Seeding Complete' : '❌ RBAC Seeding Failed'}
          </DialogTitle>
          <DialogDescription>{result?.message}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap">
            {result?.output || 'No output available'}
          </pre>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
