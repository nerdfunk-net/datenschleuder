"""Repositories for PKI Manager — CA and certificate data access."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from core.database import get_db_session
from core.models import PKIAuthority, PKICertificate
from repositories.base import BaseRepository


class PKICARepository(BaseRepository[PKIAuthority]):
    """Data access for the single Certificate Authority record."""

    def __init__(self):
        super().__init__(PKIAuthority)

    def get_active_ca(self) -> Optional[PKIAuthority]:
        """Return the most recently created CA, or None if no CA exists."""
        db = get_db_session()
        try:
            return (
                db.query(PKIAuthority).order_by(PKIAuthority.created_at.desc()).first()
            )
        finally:
            db.close()


class PKICertificateRepository(BaseRepository[PKICertificate]):
    """Data access for certificates issued by the local CA."""

    def __init__(self):
        super().__init__(PKICertificate)

    def get_all_for_ca(self, ca_id: int) -> List[PKICertificate]:
        """Return all certificates for a CA ordered by creation date desc."""
        db = get_db_session()
        try:
            return (
                db.query(PKICertificate)
                .filter(PKICertificate.ca_id == ca_id)
                .order_by(PKICertificate.created_at.desc())
                .all()
            )
        finally:
            db.close()

    def get_revoked_for_ca(self, ca_id: int) -> List[PKICertificate]:
        """Return all revoked certificates for a CA."""
        db = get_db_session()
        try:
            return (
                db.query(PKICertificate)
                .filter(
                    PKICertificate.ca_id == ca_id,
                    PKICertificate.is_revoked.is_(True),
                )
                .order_by(PKICertificate.revoked_at.desc())
                .all()
            )
        finally:
            db.close()

    def delete_all_for_ca(self, ca_id: int) -> int:
        """Delete all certificates for a CA. Returns the number deleted."""
        db = get_db_session()
        try:
            count = (
                db.query(PKICertificate)
                .filter(PKICertificate.ca_id == ca_id)
                .delete(synchronize_session=False)
            )
            db.commit()
            return count
        finally:
            db.close()

    def revoke(self, cert_id: int, reason: str) -> Optional[PKICertificate]:
        """Mark a certificate as revoked."""
        db = get_db_session()
        try:
            cert = db.query(PKICertificate).filter(PKICertificate.id == cert_id).first()
            if cert:
                cert.is_revoked = True
                cert.revoked_at = datetime.now(timezone.utc)
                cert.revocation_reason = reason
                db.commit()
                db.refresh(cert)
            return cert
        finally:
            db.close()
