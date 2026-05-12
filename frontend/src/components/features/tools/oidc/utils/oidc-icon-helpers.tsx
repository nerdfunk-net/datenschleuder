import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react'
import type { DebugLog } from '../types/oidc-types'

export function getStatusIcon(status: 'ok' | 'warning' | 'error') {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />
  }
}

export function getLevelIcon(level: DebugLog['level']) {
  switch (level) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'info':
      return <Info className="w-4 h-4 text-blue-500" />
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-yellow-500" />
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />
  }
}
