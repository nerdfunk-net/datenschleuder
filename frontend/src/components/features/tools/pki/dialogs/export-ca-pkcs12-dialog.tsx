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
  onSubmit: (password: string) => void
  isPending: boolean
}

export function ExportCAPKCS12Dialog({ open, onOpenChange, onSubmit, isPending }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) { setError('Password is required'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    onSubmit(password)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) { setPassword(''); setConfirm(''); setError('') }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export CA PKCS#12 with Private Key</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The CA private key will be included and encrypted with the password you provide.
          </p>
          <div>
            <Label htmlFor="ca-pkcs12-pw">Password *</Label>
            <Input
              id="ca-pkcs12-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Keystore password"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ca-pkcs12-pw2">Confirm Password</Label>
            <Input
              id="ca-pkcs12-pw2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
