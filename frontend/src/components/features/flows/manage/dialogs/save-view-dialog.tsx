'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

interface SaveViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided the dialog is in update mode */
  existingName?: string
  existingDescription?: string | null
  existingIsDefault?: boolean
  onSave: (name: string, description: string, isDefault: boolean) => void
  isSaving: boolean
}

export function SaveViewDialog({
  open,
  onOpenChange,
  existingName,
  existingDescription,
  existingIsDefault = false,
  onSave,
  isSaving,
}: SaveViewDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (open) {
      setName(existingName ?? '')
      setDescription(existingDescription ?? '')
      setIsDefault(existingIsDefault)
    }
  }, [open, existingName, existingDescription, existingIsDefault])

  function handleSubmit() {
    if (!name.trim()) return
    onSave(name.trim(), description.trim(), isDefault)
  }

  const isUpdate = !!existingName

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isUpdate ? 'Update View' : 'Save View'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="View name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="view-desc">Description</Label>
            <Textarea
              id="view-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} id="view-default" />
            <Label htmlFor="view-default">Set as default view</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
            {isSaving ? 'Saving…' : isUpdate ? 'Update' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
