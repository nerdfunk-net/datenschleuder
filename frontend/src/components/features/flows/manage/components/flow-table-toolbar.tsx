import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Plus, Columns, BookmarkCheck, Pencil, Trash2, Star, Wand2 } from 'lucide-react'
import type { FlowColumn, FlowView } from '../types'

interface FlowTableToolbarProps {
  allColumns: FlowColumn[]
  visibleColumnKeys: string[]
  activeView: FlowView | null
  flowViews: FlowView[]
  activeViewId: number | null
  canWrite: boolean
  canDelete: boolean
  onToggleColumn: (key: string) => void
  onShowAllColumns: () => void
  onDeselectAllColumns: () => void
  onLoadView: (view: FlowView) => void
  onOpenSaveView: (viewId?: number) => void
  onDeleteView: (id: number) => void
  onSetDefaultView: (id: number) => void
  onWizardOpen: () => void
  onAdd: () => void
}

export function FlowTableToolbar({
  allColumns,
  visibleColumnKeys,
  activeView,
  flowViews,
  activeViewId,
  canWrite,
  canDelete,
  onToggleColumn,
  onShowAllColumns,
  onDeselectAllColumns,
  onLoadView,
  onOpenSaveView,
  onDeleteView,
  onSetDefaultView,
  onWizardOpen,
  onAdd,
}: FlowTableToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Column visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns className="mr-2 h-4 w-4" />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onShowAllColumns}>Select All</DropdownMenuItem>
          <DropdownMenuItem onClick={onDeselectAllColumns}>Deselect All</DropdownMenuItem>
          <DropdownMenuSeparator />
          {allColumns.map(col => (
            <DropdownMenuCheckboxItem
              key={col.key}
              checked={visibleColumnKeys.includes(col.key)}
              onCheckedChange={() => onToggleColumn(col.key)}
              onSelect={e => e.preventDefault()}
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Views */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <BookmarkCheck className="mr-2 h-4 w-4" />
            Views
            {activeView && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeView.name}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canWrite && (
            <>
              <DropdownMenuItem onClick={() => onOpenSaveView()}>
                <Plus className="mr-2 h-4 w-4" />
                Save current as new view
              </DropdownMenuItem>
              {activeView && (
                <DropdownMenuItem onClick={() => onOpenSaveView(activeView.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Update &ldquo;{activeView.name}&rdquo;
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          {flowViews.length === 0 && (
            <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
          )}
          {flowViews.map(view => (
            <div key={view.id} className="flex items-center group">
              <DropdownMenuItem className="flex-1" onClick={() => onLoadView(view)}>
                {view.is_default && <Star className="mr-1.5 h-3 w-3 text-amber-400" />}
                <span className={activeViewId === view.id ? 'font-semibold' : ''}>
                  {view.name}
                </span>
              </DropdownMenuItem>
              {canWrite && (
                <div className="flex pr-1 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!view.is_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={e => { e.preventDefault(); onSetDefaultView(view.id) }}
                      title="Set as default"
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500"
                      onClick={e => { e.preventDefault(); onDeleteView(view.id) }}
                      title="Delete view"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite && (
        <>
          <Button size="sm" variant="outline" onClick={onWizardOpen}>
            <Wand2 className="mr-2 h-4 w-4" />
            Wizard
          </Button>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Flow
          </Button>
        </>
      )}
    </div>
  )
}
