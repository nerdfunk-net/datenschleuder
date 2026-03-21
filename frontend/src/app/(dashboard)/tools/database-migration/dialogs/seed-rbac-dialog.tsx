import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface SeedRbacDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSeed: () => void
}

export function SeedRbacDialog({ open, onOpenChange, onSeed }: SeedRbacDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seed RBAC System?</DialogTitle>
          <DialogDescription>
            The database migration was successful. Would you like to seed the RBAC system with
            default permissions and roles? This will ensure all permissions are up-to-date with
            the new database schema.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={onSeed} className="bg-blue-600 hover:bg-blue-700">
            Seed RBAC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
