'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useNifiHierarchyValuesQuery } from '@/components/features/settings/nifi/hooks/use-nifi-instances-query'

export interface HierarchyComboboxProps {
  attributeName: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function HierarchyCombobox({ attributeName, value, onChange, disabled }: HierarchyComboboxProps) {
  const { data } = useNifiHierarchyValuesQuery(attributeName)
  const savedValues = data?.values ?? []

  const handleChange = useCallback((newValue: string) => {
    onChange(newValue)
  }, [onChange])

  return (
    <div className="flex h-9">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-8 px-0 rounded-r-none border-r-0 shrink-0"
            disabled={disabled || savedValues.length === 0}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
          {savedValues.map(v => (
            <DropdownMenuItem key={v} onSelect={() => handleChange(v)}>
              {v}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={`Select or type ${attributeName}`}
        disabled={disabled}
        className="rounded-l-none h-9 min-w-0"
      />
    </div>
  )
}
