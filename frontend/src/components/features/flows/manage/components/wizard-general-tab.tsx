'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FileText } from 'lucide-react'
import type { WizardFormReturn } from '../hooks/use-wizard-form'

interface WizardGeneralTabProps {
  wizard: WizardFormReturn
}

export function WizardGeneralTab({ wizard }: WizardGeneralTabProps) {
  const { state, setField } = wizard

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setField('name', e.target.value),
    [setField],
  )
  const handleContactChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setField('contact', e.target.value),
    [setField],
  )
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setField('description', e.target.value),
    [setField],
  )
  const handleActiveChange = useCallback(
    (checked: boolean) => setField('active', checked),
    [setField],
  )

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-4 rounded-lg flex items-center gap-2">
        <FileText className="h-5 w-5" />
        <span className="font-medium">General Information</span>
      </div>

      <div className="space-y-4 px-2">
        <div className="space-y-2">
          <Label htmlFor="wizard-name">Name</Label>
          <Input
            id="wizard-name"
            value={state.name}
            onChange={handleNameChange}
            placeholder="Flow name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-contact">Contact</Label>
          <Input
            id="wizard-contact"
            value={state.contact}
            onChange={handleContactChange}
            placeholder="Contact information"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-description">Description</Label>
          <Textarea
            id="wizard-description"
            value={state.description}
            onChange={handleDescriptionChange}
            placeholder="Flow description"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="wizard-active"
            checked={state.active}
            onCheckedChange={handleActiveChange}
          />
          <Label htmlFor="wizard-active" className="cursor-pointer font-normal">
            Active
          </Label>
        </div>
      </div>
    </div>
  )
}
