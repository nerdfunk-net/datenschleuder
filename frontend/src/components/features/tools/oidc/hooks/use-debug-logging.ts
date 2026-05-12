import { useState, useCallback, useRef, useMemo } from 'react'
import type { DebugLog } from '../types/oidc-types'

interface UseDebugLoggingReturn {
  logs: DebugLog[]
  addLog: (level: DebugLog['level'], message: string, details?: Record<string, unknown>) => void
}

export function useDebugLogging(): UseDebugLoggingReturn {
  const [logs, setLogs] = useState<DebugLog[]>([])
  const logIdRef = useRef(0)

  const addLog = useCallback(
    (level: DebugLog['level'], message: string, details?: Record<string, unknown>) => {
      const log: DebugLog = {
        id: ++logIdRef.current,
        timestamp: new Date().toISOString(),
        level,
        message,
        details,
      }
      setLogs((prev) => [log, ...prev])
    },
    [],
  )

  return useMemo(() => ({ logs, addLog }), [logs, addLog])
}
