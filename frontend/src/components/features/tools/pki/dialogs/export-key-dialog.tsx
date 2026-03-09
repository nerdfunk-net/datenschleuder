'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  certId: number | null
  onSubmit: (id: number, passphrase?: string) => void
  isPending: boolean
}

export function ExportKeyDialog({ open, onOpenChange, certId, onSubmit, isPending }: Props) {
  const [passphrase, setPassphrase] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (certId !== null) onSubmit(certId, passphrase || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPassphrase(''); onOpenChange(v) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Private Key</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Optionally protect the private key with a passphrase.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="key-passphrase">Passphrase (optional)</Label>
            <Input
              id="key-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave blank for unencrypted"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Exporting...' : 'Export Key'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
