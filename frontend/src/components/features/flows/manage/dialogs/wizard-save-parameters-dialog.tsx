'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShieldCheck, Loader2, Save, SkipForward } from 'lucide-react'
import type { SideSuggestions } from '../hooks/use-wizard-parameter-suggestions'

interface WizardSaveParametersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  srcSuggestions: SideSuggestions | null
  destSuggestions: SideSuggestions | null
  onSaveAndCreate: () => void
  onSkipAndCreate: () => void
  isSaving: boolean
}

function SidePanel({
  label,
  side,
}: {
  label: string
  side: SideSuggestions
}) {
  return (
    <div className="shadow-sm border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg">
        <ShieldCheck className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-blue-100 ml-1">— {side.contextName}</span>
      </div>
      <div className="bg-gradient-to-b from-white to-gray-50 rounded-b-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide w-1/3">
                Key
              </TableHead>
              <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Value to Save
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {side.suggestions.map(s => (
              <TableRow key={s.key} className="bg-blue-50 hover:bg-blue-100">
                <TableCell className="font-mono text-sm font-medium text-blue-900">
                  {s.key}
                </TableCell>
                <TableCell className="text-sm text-blue-800">
                  {s.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function WizardSaveParametersDialog({
  open,
  onOpenChange,
  srcSuggestions,
  destSuggestions,
  onSaveAndCreate,
  onSkipAndCreate,
  isSaving,
}: WizardSaveParametersDialogProps) {
  const contextCount = (srcSuggestions ? 1 : 0) + (destSuggestions ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save Parameters to Context{contextCount > 1 ? 's' : ''}?</DialogTitle>
          <DialogDescription>
            The following values were auto-filled during verification but are not yet configured in
            the NiFi parameter context{contextCount > 1 ? 's' : ''}. Would you like to save them
            before creating the flow?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {srcSuggestions && (
            <SidePanel label="Source Context" side={srcSuggestions} />
          )}
          {destSuggestions && (
            <SidePanel label="Destination Context" side={destSuggestions} />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={onSkipAndCreate}
            disabled={isSaving}
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Skip &amp; Create Flow
          </Button>
          <Button
            onClick={onSaveAndCreate}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save &amp; Create Flow
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
