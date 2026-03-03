'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCertManagerMutations } from '../hooks/use-cert-manager-mutations'

interface CreateKeystoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: number
}

const DEFAULT_VALIDITY = 365
const DEFAULT_KEY_SIZE = 2048

export function CreateKeystoreDialog({ open, onOpenChange, instanceId }: CreateKeystoreDialogProps) {
  const [tab, setTab] = useState<'keystore' | 'truststore'>('keystore')
  const [filename, setFilename] = useState('')
  const [password, setPassword] = useState('')
  const [cn, setCn] = useState('')
  const [ou, setOu] = useState('')
  const [o, setO] = useState('')
  const [c, setC] = useState('')
  const [validityDays, setValidityDays] = useState(String(DEFAULT_VALIDITY))
  const [keySize, setKeySize] = useState(String(DEFAULT_KEY_SIZE))

  const { createKeystore, createTruststore } = useCertManagerMutations()

  const isPending = createKeystore.isPending || createTruststore.isPending

  const handleCreate = () => {
    if (!filename.trim() || !cn.trim()) return
    if (tab === 'keystore') {
      if (!password) return
      createKeystore.mutate(
        {
          instance_id: instanceId,
          filename: filename.trim(),
          password,
          subject_cn: cn.trim(),
          subject_ou: ou.trim() || undefined,
          subject_o: o.trim() || undefined,
          subject_c: c.trim() || undefined,
          validity_days: Number(validityDays) || DEFAULT_VALIDITY,
          key_size: Number(keySize) || DEFAULT_KEY_SIZE,
        },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      createTruststore.mutate(
        {
          instance_id: instanceId,
          filename: filename.trim(),
          subject_cn: cn.trim(),
          subject_ou: ou.trim() || undefined,
          subject_o: o.trim() || undefined,
          subject_c: c.trim() || undefined,
          validity_days: Number(validityDays) || DEFAULT_VALIDITY,
        },
        { onSuccess: () => onOpenChange(false) }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Keystore / Truststore</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'keystore' | 'truststore')}>
          <TabsList className="w-full">
            <TabsTrigger value="keystore" className="flex-1">Keystore (PKCS12)</TabsTrigger>
            <TabsTrigger value="truststore" className="flex-1">Truststore (PEM)</TabsTrigger>
          </TabsList>

          <div className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label htmlFor="ks-filename">Output filename (relative to repo root)</Label>
              <Input
                id="ks-filename"
                placeholder={tab === 'keystore' ? 'certs/keystore.p12' : 'certs/truststore.pem'}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>

            <TabsContent value="keystore" className="mt-0 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="ks-password">Keystore password</Label>
                <Input
                  id="ks-password"
                  type="password"
                  placeholder="Required"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </TabsContent>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="ks-cn">Common Name (CN) *</Label>
                <Input
                  id="ks-cn"
                  placeholder="e.g. nifi.example.com"
                  value={cn}
                  onChange={(e) => setCn(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ks-ou">Organizational Unit (OU)</Label>
                <Input
                  id="ks-ou"
                  placeholder="IT"
                  value={ou}
                  onChange={(e) => setOu(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ks-o">Organization (O)</Label>
                <Input
                  id="ks-o"
                  placeholder="ACME Corp"
                  value={o}
                  onChange={(e) => setO(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ks-c">Country (C)</Label>
                <Input
                  id="ks-c"
                  placeholder="DE"
                  maxLength={2}
                  value={c}
                  onChange={(e) => setC(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ks-validity">Validity (days)</Label>
                <Input
                  id="ks-validity"
                  type="number"
                  min={1}
                  max={3650}
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                />
              </div>
            </div>

            {tab === 'keystore' && (
              <div className="space-y-1">
                <Label htmlFor="ks-keysize">RSA Key size (bits)</Label>
                <Input
                  id="ks-keysize"
                  type="number"
                  value={keySize}
                  onChange={(e) => setKeySize(e.target.value)}
                />
              </div>
            )}
          </div>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !filename.trim() ||
              !cn.trim() ||
              (tab === 'keystore' && !password) ||
              isPending
            }
          >
            {isPending ? 'Creating...' : `Create ${tab === 'keystore' ? 'Keystore' : 'Truststore'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
