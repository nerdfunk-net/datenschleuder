'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Save } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import { generateAvatarDataUrl } from '@/components/ui/local-avatar'
import { useProfileQuery } from './hooks/queries/use-profile-query'
import { useProfileMutations } from './hooks/queries/use-profile-mutations'
import type { ProfileUpdatePayload } from './hooks/queries/use-profile-mutations'
import type { PersonalCredential, ProfileData } from './types/profile-types'
import { validateApiKey, generateApiKey } from './utils/profile-validators'
import { generateCredentialId, mapServerCredential, buildCredentialPayload } from './utils/credential-transform'
import { PersonalInfoSection } from './components/personal-info-section'
import { TokensCard } from './components/api-key-section'
import { CredentialForm } from './components/credential-form'
import { PasswordSection } from './components/password-section'

export function ProfilePage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const { data: profileData, isLoading } = useProfileQuery()
  const { updateProfile } = useProfileMutations()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')

  const [formData, setFormData] = useState<ProfileData>({
    username: user?.username || '',
    realname: '',
    email: '',
    api_key: '',
    personal_credentials: [],
  })

  // Initialize form from server data
  useEffect(() => {
    if (!profileData) return
    setFormData({
      username: profileData.username || user?.username || '',
      realname: profileData.realname || '',
      email: profileData.email || '',
      api_key: profileData.api_key || '',
      personal_credentials: (profileData.personal_credentials || []).map(mapServerCredential),
    })
  }, [profileData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Credential handlers
  const addPersonalCredential = () => {
    const newCred: PersonalCredential = {
      id: generateCredentialId(),
      name: '',
      username: '',
      type: 'SSH',
      password: '',
      isOpen: true,
      showPassword: false,
      hasStoredPassword: false,
      passwordChanged: false,
    }
    setFormData((prev) => ({
      ...prev,
      personal_credentials: [...prev.personal_credentials, newCred],
    }))
  }

  const removePersonalCredential = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      personal_credentials: prev.personal_credentials.filter((c) => c.id !== id),
    }))
  }

  const updatePersonalCredential = (
    id: string,
    field: keyof PersonalCredential,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      personal_credentials: prev.personal_credentials.map((cred) => {
        if (cred.id !== id) return cred
        const updated = { ...cred, [field]: value }
        if (field === 'password') updated.passwordChanged = true
        if (field === 'ssh_private_key' || field === 'ssh_passphrase') updated.sshKeyChanged = true
        if (field === 'type' && value !== 'SSH_KEY') {
          updated.ssh_private_key = ''
          updated.ssh_passphrase = ''
          updated.has_ssh_key = false
          updated.sshKeyChanged = false
        }
        return updated
      }),
    }))
  }

  const toggleCredentialExpanded = (id: string) => {
    const cred = formData.personal_credentials.find((c) => c.id === id)
    updatePersonalCredential(id, 'isOpen', !cred?.isOpen)
  }

  const toggleCredentialPasswordVisibility = (id: string) => {
    const cred = formData.personal_credentials.find((c) => c.id === id)
    updatePersonalCredential(id, 'showPassword', !cred?.showPassword)
  }

  const toggleCredentialSshPassphraseVisibility = (id: string) => {
    const cred = formData.personal_credentials.find((c) => c.id === id)
    updatePersonalCredential(id, 'showSshPassphrase', !cred?.showSshPassphrase)
  }

  const handleSshKeyFileChange = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      updatePersonalCredential(id, 'ssh_private_key', e.target?.result as string)
    }
    reader.readAsText(file)
  }

  const validatePasswords = () => {
    if (passwords.newPassword || passwords.confirmPassword) {
      if (passwords.newPassword !== passwords.confirmPassword) {
        setPasswordError('Passwords do not match')
        return false
      }
      if (passwords.newPassword.length < 4) {
        setPasswordError('Password must be at least 4 characters long')
        return false
      }
    }
    setPasswordError('')
    return true
  }

  const handleSave = () => {
    if (!validatePasswords()) return

    const apiKeyError = validateApiKey(formData.api_key)
    if (apiKeyError) {
      toast({ title: 'Validation Error', description: apiKeyError, variant: 'destructive' })
      return
    }

    const payload: ProfileUpdatePayload = {
      realname: formData.realname,
      email: formData.email,
      api_key: formData.api_key,
      personal_credentials: formData.personal_credentials.map(buildCredentialPayload),
    }
    if (passwords.newPassword) payload.password = passwords.newPassword

    updateProfile.mutate(payload, {
      onSuccess: () => {
        setPasswords({ newPassword: '', confirmPassword: '' })
        setPasswordError('')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16 ring-2 ring-blue-100">
            <AvatarImage
              src={generateAvatarDataUrl(formData.username, 64)}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-lg">
              {formData.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
            <p className="text-slate-600">Manage your account settings and preferences</p>
          </div>
        </div>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Personal Information</TabsTrigger>
            <TabsTrigger value="tokens">Tokens & Credentials</TabsTrigger>
            <TabsTrigger value="password">Change Password</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <PersonalInfoSection
              username={formData.username}
              realname={formData.realname}
              email={formData.email}
              onRealnameChange={(v) => setFormData((p) => ({ ...p, realname: v }))}
              onEmailChange={(v) => setFormData((p) => ({ ...p, email: v }))}
            />
          </TabsContent>

          <TabsContent value="tokens" className="space-y-4">
            <TokensCard
              apiKey={formData.api_key}
              onApiKeyChange={(v) => setFormData((p) => ({ ...p, api_key: v }))}
              onApiKeyGenerate={() => setFormData((p) => ({ ...p, api_key: generateApiKey() }))}
            >
              <CredentialForm
                credentials={formData.personal_credentials}
                onAdd={addPersonalCredential}
                onRemove={removePersonalCredential}
                onUpdate={updatePersonalCredential}
                onToggleExpanded={toggleCredentialExpanded}
                onTogglePasswordVisibility={toggleCredentialPasswordVisibility}
                onToggleSshPassphraseVisibility={toggleCredentialSshPassphraseVisibility}
                onSshKeyFileChange={handleSshKeyFileChange}
              />
            </TokensCard>
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <PasswordSection
              newPassword={passwords.newPassword}
              confirmPassword={passwords.confirmPassword}
              passwordError={passwordError}
              showPassword={showPassword}
              showConfirmPassword={showConfirmPassword}
              onNewPasswordChange={(v) => {
                setPasswords((p) => ({ ...p, newPassword: v }))
                setPasswordError('')
              }}
              onConfirmPasswordChange={(v) => {
                setPasswords((p) => ({ ...p, confirmPassword: v }))
                setPasswordError('')
              }}
              onToggleShowPassword={() => setShowPassword((p) => !p)}
              onToggleShowConfirmPassword={() => setShowConfirmPassword((p) => !p)}
            />
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={
              updateProfile.isPending ||
              !!passwordError ||
              (formData.api_key.length > 0 && formData.api_key.length !== 42)
            }
            className="min-w-[120px] bg-green-600 hover:bg-green-700 text-white"
          >
            {updateProfile.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
