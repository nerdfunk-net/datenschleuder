export function validateApiKey(apiKey: string): string {
  if (apiKey.length === 0) return ''
  if (apiKey.length !== 42) return 'API key must be exactly 42 characters long'
  return ''
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 42; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
