"""OIDC authentication service package.

Public API — import OIDCService and oidc_service from this package.
"""

from __future__ import annotations

from services.auth.oidc.service import OIDCService  # noqa: F401

# Global singleton instance (backward-compatible with `from services.auth.oidc import oidc_service`)
oidc_service = OIDCService()
