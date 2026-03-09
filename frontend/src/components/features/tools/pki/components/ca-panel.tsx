'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ShieldAlert, Trash2, Download } from 'lucide-react'
import { useCAQuery } from '../hooks/use-pki-query'
import { usePKIMutations } from '../hooks/use-pki-mutations'
import { CreateCADialog } from '../dialogs/create-ca-dialog'
import type { CreateCARequest } from '../types'

export function CAPanel() {
  const { data: ca, isLoading } = useCAQuery()
  const mutations = usePKIMutations()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const formatDate = (d: string) => new Date(d).toLocaleDateString()
  const isExpired = ca ? new Date(ca.not_after) < new Date() : false

  const handleCreate = (data: CreateCARequest) => {
    mutations.createCA.mutate(data, {
      onSuccess: () => setCreateOpen(false),
    })
  }

  const handleDelete = () => {
    mutations.deleteCA.mutate(undefined, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading CA...</div>
  }

  if (!ca) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground" />
        <div>
          <p className="font-medium">No Certificate Authority</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a CA to start issuing certificates.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create CA</Button>
        <CreateCADialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreate}
          isPending={mutations.createCA.isPending}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              {ca.common_name}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isExpired
                ? <Badge variant="destructive">Expired</Badge>
                : <Badge variant="default" className="bg-green-600">Active</Badge>
              }
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {ca.organization && <div><span className="text-muted-foreground">Organization</span><p>{ca.organization}</p></div>}
            {ca.country && <div><span className="text-muted-foreground">Country</span><p>{ca.country}</p></div>}
            <div><span className="text-muted-foreground">Valid From</span><p>{formatDate(ca.not_before)}</p></div>
            <div><span className="text-muted-foreground">Valid Until</span><p>{formatDate(ca.not_after)}</p></div>
            <div><span className="text-muted-foreground">Key Size</span><p>{ca.key_size} bit</p></div>
            <div>
              <span className="text-muted-foreground">Serial</span>
              <p className="font-mono text-xs truncate">{ca.serial_number}</p>
            </div>
            {ca.created_by && <div><span className="text-muted-foreground">Created by</span><p>{ca.created_by}</p></div>}
          </div>
          <div className="flex gap-2 pt-2">
            <a href={`/api/proxy/pki/ca/cert`} download={`${ca.common_name.replace(/ /g, '_')}.ca.pem`}>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Download CA Cert
              </Button>
            </a>
            <a href="/api/proxy/pki/crl" download="ca.crl.pem">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Download CRL
              </Button>
            </a>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete CA
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate Authority?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the CA and all issued certificates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
