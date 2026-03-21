import { useState, useMemo } from 'react'

export interface UseOidcTestParametersReturn {
  useCustomParams: boolean
  setUseCustomParams: (value: boolean) => void
  useDebugCallback: boolean
  setUseDebugCallback: (value: boolean) => void
  customRedirectUri: string
  setCustomRedirectUri: (value: string) => void
  customScopes: string
  setCustomScopes: (value: string) => void
  customResponseType: string
  setCustomResponseType: (value: string) => void
  customClientId: string
  setCustomClientId: (value: string) => void
}

export function useOidcTestParameters(): UseOidcTestParametersReturn {
  const [useCustomParams, setUseCustomParams] = useState(false)
  const [useDebugCallback, setUseDebugCallback] = useState(false)
  const [customRedirectUri, setCustomRedirectUri] = useState('')
  const [customScopes, setCustomScopes] = useState('')
  const [customResponseType, setCustomResponseType] = useState('')
  const [customClientId, setCustomClientId] = useState('')

  return useMemo(
    () => ({
      useCustomParams,
      setUseCustomParams,
      useDebugCallback,
      setUseDebugCallback,
      customRedirectUri,
      setCustomRedirectUri,
      customScopes,
      setCustomScopes,
      customResponseType,
      setCustomResponseType,
      customClientId,
      setCustomClientId,
    }),
    [
      useCustomParams,
      useDebugCallback,
      customRedirectUri,
      customScopes,
      customResponseType,
      customClientId,
    ],
  )
}
