import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Eye, EyeOff, Plus, Trash2, ChevronDown, ChevronRight, Check, Key } from 'lucide-react'
import type { PersonalCredential } from '../types/profile-types'

interface CredentialFormProps {
  credentials: PersonalCredential[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: keyof PersonalCredential, value: string | boolean) => void
  onToggleExpanded: (id: string) => void
  onTogglePasswordVisibility: (id: string) => void
  onToggleSshPassphraseVisibility: (id: string) => void
  onSshKeyFileChange: (id: string, event: React.ChangeEvent<HTMLInputElement>) => void
}

export function CredentialForm({
  credentials,
  onAdd,
  onRemove,
  onUpdate,
  onToggleExpanded,
  onTogglePasswordVisibility,
  onToggleSshPassphraseVisibility,
  onSshKeyFileChange,
}: CredentialFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Personal Credentials</Label>
          <p className="text-sm text-slate-500">Manage your personal authentication credentials</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Credential</span>
        </Button>
      </div>

      {credentials.length === 0 ? (
        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <Key className="h-8 w-8 mx-auto mb-2 text-slate-400" />
          <p>No personal credentials configured</p>
          <p className="text-sm">Click &ldquo;Add Credential&rdquo; to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((credential) => (
            <div key={credential.id} className="border rounded-lg">
              <Collapsible
                open={credential.isOpen}
                onOpenChange={() => onToggleExpanded(credential.id)}
              >
                <div className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <CollapsibleTrigger className="flex items-center space-x-3 flex-1 text-left">
                    {credential.isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    <div>
                      <div className="font-medium">
                        {credential.name || 'Unnamed Credential'}
                      </div>
                      <div className="text-sm text-slate-500">
                        {credential.type === 'SSH_KEY' ? 'SSH Key' : credential.type} •{' '}
                        {credential.username || 'No username'}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(credential.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4 border-t bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor={`cred-name-${credential.id}`}>Name</Label>
                        <Input
                          id={`cred-name-${credential.id}`}
                          value={credential.name}
                          onChange={(e) => onUpdate(credential.id, 'name', e.target.value)}
                          placeholder="Enter credential name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cred-type-${credential.id}`}>Type</Label>
                        <Select
                          value={credential.type}
                          onValueChange={(value) => onUpdate(credential.id, 'type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SSH">SSH</SelectItem>
                            <SelectItem value="SSH_KEY">SSH Key</SelectItem>
                            <SelectItem value="TACACS">TACACS</SelectItem>
                            <SelectItem value="Generic">Generic</SelectItem>
                            <SelectItem value="Token">Token</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cred-username-${credential.id}`}>Username</Label>
                        <Input
                          id={`cred-username-${credential.id}`}
                          value={credential.username}
                          onChange={(e) => onUpdate(credential.id, 'username', e.target.value)}
                          placeholder="Enter username"
                        />
                      </div>

                      {credential.type !== 'SSH_KEY' && (
                        <div className="space-y-2">
                          <Label htmlFor={`cred-password-${credential.id}`}>
                            {credential.type === 'Token' ? 'Token' : 'Password'}
                          </Label>
                          <div className="relative">
                            <Input
                              id={`cred-password-${credential.id}`}
                              type={credential.showPassword ? 'text' : 'password'}
                              value={credential.password}
                              onChange={(e) => onUpdate(credential.id, 'password', e.target.value)}
                              placeholder={credential.type === 'Token' ? 'Enter token' : 'Enter password'}
                              className="pr-10"
                              onFocus={() => {
                                if (credential.password && /^•+$/.test(credential.password)) {
                                  onUpdate(credential.id, 'password', '')
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2"
                              onClick={() => onTogglePasswordVisibility(credential.id)}
                            >
                              {credential.showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {credential.type === 'SSH_KEY' && (
                        <>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`cred-ssh-key-${credential.id}`}>SSH Private Key</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id={`cred-ssh-key-${credential.id}`}
                                type="file"
                                onChange={(e) => onSshKeyFileChange(credential.id, e)}
                                className="flex-1"
                              />
                              {(credential.ssh_private_key || credential.has_ssh_key) && (
                                <div className="flex items-center gap-1 text-green-600 text-sm">
                                  <Check className="h-4 w-4" />
                                  <span>
                                    {credential.has_ssh_key && !credential.ssh_private_key
                                      ? 'Key stored'
                                      : 'Key loaded'}
                                  </span>
                                </div>
                              )}
                            </div>
                            {credential.has_ssh_key && !credential.ssh_private_key && (
                              <p className="text-sm text-slate-500">
                                SSH key is already stored. Upload a new key to replace it.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`cred-ssh-passphrase-${credential.id}`}>
                              SSH Key Passphrase (Optional)
                            </Label>
                            <div className="relative">
                              <Input
                                id={`cred-ssh-passphrase-${credential.id}`}
                                type={credential.showSshPassphrase ? 'text' : 'password'}
                                value={credential.ssh_passphrase || ''}
                                onChange={(e) =>
                                  onUpdate(credential.id, 'ssh_passphrase', e.target.value)
                                }
                                placeholder="Enter passphrase if key is encrypted"
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2"
                                onClick={() => onToggleSshPassphraseVisibility(credential.id)}
                              >
                                {credential.showSshPassphrase ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
