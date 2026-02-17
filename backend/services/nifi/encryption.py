"""Encryption service using Fernet symmetric encryption.

Uses SECRET_KEY to derive a Fernet encryption key via SHA256.
"""

import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

from config import settings

logger = logging.getLogger(__name__)


def _build_key(secret: str) -> bytes:
    """Build Fernet key from secret using SHA256 hash."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


class EncryptionService:
    """Service for encrypting and decrypting passwords using Fernet."""

    def __init__(self, secret_key: Optional[str] = None):
        """Initialize encryption service with secret key."""
        secret = secret_key or settings.secret_key
        if not secret:
            raise RuntimeError("SECRET_KEY not set for encryption")
        self._fernet = Fernet(_build_key(secret))

    def encrypt(self, plaintext: str) -> bytes:
        """Encrypt plaintext string to bytes (LargeBinary-compatible)."""
        return self._fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, token: bytes) -> str:
        """Decrypt bytes token to plaintext string."""
        try:
            return self._fernet.decrypt(token).decode("utf-8")
        except InvalidToken as e:
            raise ValueError("Failed to decrypt stored password") from e


# Global encryption service instance
encryption_service = EncryptionService()
