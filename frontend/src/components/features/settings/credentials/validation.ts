import { z } from 'zod'

export const credentialFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  username: z.string().min(1, 'Username is required').max(128),
  type: z.enum(['ssh', 'ssh_key', 'tacacs', 'generic', 'token']),
  password: z.string().optional(),
  ssh_private_key: z.string().optional(),
  ssh_passphrase: z.string().optional(),
  ssh_keyfile_path: z.string().optional(),
  valid_until: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'ssh_key') {
      // Require either an SSH private key or a keyfile path
      return !!data.ssh_private_key?.trim() || !!data.ssh_keyfile_path?.trim()
    }
    // For other types, require password
    return !!data.password?.trim()
  },
  {
    message: 'Provide an SSH private key, upload a key file, or enter the SSH keyfile path',
    path: ['ssh_keyfile_path'],
  }
)

export type CredentialFormValues = z.infer<typeof credentialFormSchema>

// For edit mode - all fields optional except name/username
export const credentialEditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  username: z.string().min(1, 'Username is required').max(128),
  type: z.enum(['ssh', 'ssh_key', 'tacacs', 'generic', 'token']),
  password: z.string().optional(),
  ssh_private_key: z.string().optional(),
  ssh_passphrase: z.string().optional(),
  ssh_keyfile_path: z.string().optional(),
  valid_until: z.string().optional(),
})

export type CredentialEditValues = z.infer<typeof credentialEditSchema>
