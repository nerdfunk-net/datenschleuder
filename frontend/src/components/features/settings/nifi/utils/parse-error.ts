/**
 * Extracts a human-readable message from a raw API error string.
 * The backend returns HTTPException with a dict detail, e.g.:
 *   "API Error 502: {"detail": {"connected": false, "error": "some error"}}"
 */
export function tryParseNifiError(raw: string): string {
  let message = raw
  try {
    const jsonStart = raw.indexOf('{')
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart))
      const detail = parsed?.detail
      if (detail) {
        if (typeof detail === 'string') message = detail
        else if (typeof detail === 'object') {
          message = detail.error || detail.message || JSON.stringify(detail)
        }
      }
    }
  } catch {
    // Not JSON, keep original
  }

  if (message.includes('SSLV3_ALERT_CERTIFICATE_UNKNOWN') || message.includes('ssl/tls alert certificate unknown')) {
    return (
      message +
      '\n\nHint: NiFi rejected the client certificate. This usually means:\n' +
      '• The certificate\'s CA is not trusted by NiFi\'s TrustStore, or\n' +
      '• The certificate has the wrong Extended Key Usage — it must include "clientAuth" (TLS Web Client Authentication), not only "serverAuth".\n' +
      'Check the certificate\'s EKU with: openssl x509 -in <cert.pem> -noout -text | grep -A2 "Extended Key Usage"'
    )
  }

  return message
}
