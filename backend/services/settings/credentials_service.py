"""Credential storage and encryption service.

Handles encrypted credential CRUD using Fernet encryption.
"""

from __future__ import annotations
import base64
import os
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet, InvalidToken
from config import settings as config_settings
from repositories import CredentialsRepository
from core.models import Credential


def _build_key(secret: str) -> bytes:
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"datenschleuder-credential-encryption",
        iterations=100_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


class EncryptionService:
    def __init__(self, secret_key: Optional[str] = None):
        secret = secret_key or os.getenv("SECRET_KEY") or config_settings.secret_key
        if not secret:
            raise RuntimeError("SECRET_KEY not set for credential encryption")
        self._fernet = Fernet(_build_key(secret))

    def encrypt(self, plaintext: str) -> bytes:
        return self._fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, token: bytes) -> str:
        try:
            return self._fernet.decrypt(token).decode("utf-8")
        except InvalidToken as e:
            raise ValueError("Failed to decrypt stored credential") from e


def _credential_to_dict(cred: Credential) -> Dict[str, Any]:
    valid_until = cred.valid_until
    status = "active"
    if valid_until:
        try:
            d = datetime.fromisoformat(valid_until).date()
            today = date.today()
            if d < today:
                status = "expired"
            elif (d - today).days <= 7:
                status = "expiring"
        except Exception:
            status = "unknown"
    return {
        "id": cred.id,
        "name": cred.name,
        "username": cred.username,
        "type": cred.type,
        "valid_until": cred.valid_until,
        "is_active": cred.is_active,
        "source": cred.source,
        "owner": cred.owner,
        "created_at": cred.created_at.isoformat() if cred.created_at else None,
        "updated_at": cred.updated_at.isoformat() if cred.updated_at else None,
        "status": status,
        "has_password": cred.password_encrypted is not None,
        "has_ssh_key": cred.ssh_key_encrypted is not None,
        "has_ssh_passphrase": cred.ssh_passphrase_encrypted is not None,
        "ssh_keyfile_path": cred.ssh_keyfile_path,
    }


class CredentialsService:
    def __init__(self):
        self.creds_repo = CredentialsRepository()
        self._enc: Optional[EncryptionService] = None

    def _get_enc(self) -> EncryptionService:
        if self._enc is None:
            self._enc = EncryptionService()
        return self._enc

    def list_credentials(
        self, include_expired: bool = False, source: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if source:
            creds = self.creds_repo.get_by_source(source)
        else:
            creds = self.creds_repo.get_all()
        items = [_credential_to_dict(c) for c in creds]
        if not include_expired:
            items = [i for i in items if i["status"] != "expired"]
        return items

    def get_credential_by_id(self, cred_id: int) -> Optional[Dict[str, Any]]:
        cred = self.creds_repo.get_by_id(cred_id)
        return _credential_to_dict(cred) if cred else None

    def create_credential(
        self,
        name: str,
        username: str,
        cred_type: str,
        password: Optional[str] = None,
        valid_until: Optional[str] = None,
        source: str = "general",
        owner: Optional[str] = None,
        ssh_private_key: Optional[str] = None,
        ssh_passphrase: Optional[str] = None,
        ssh_keyfile_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.utcnow()
        encrypted_password = self._get_enc().encrypt(password) if password else None
        encrypted_ssh_key = (
            self._get_enc().encrypt(ssh_private_key) if ssh_private_key else None
        )
        encrypted_ssh_passphrase = (
            self._get_enc().encrypt(ssh_passphrase) if ssh_passphrase else None
        )
        new_cred = self.creds_repo.create(
            name=name,
            username=username,
            type=cred_type,
            password_encrypted=encrypted_password,
            ssh_key_encrypted=encrypted_ssh_key,
            ssh_passphrase_encrypted=encrypted_ssh_passphrase,
            ssh_keyfile_path=ssh_keyfile_path or None,
            valid_until=valid_until,
            source=source,
            owner=owner,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        if cred_type == "ssh_key" and ssh_private_key:
            from services.settings.ssh_key_service import SSHKeyService

            SSHKeyService().export_single_ssh_key(new_cred.id)
        return _credential_to_dict(new_cred)

    def update_credential(
        self,
        cred_id: int,
        name: Optional[str] = None,
        username: Optional[str] = None,
        cred_type: Optional[str] = None,
        password: Optional[str] = None,
        valid_until: Optional[str] = None,
        source: Optional[str] = None,
        owner: Optional[str] = None,
        ssh_private_key: Optional[str] = None,
        ssh_passphrase: Optional[str] = None,
        ssh_keyfile_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = self.creds_repo.get_by_id(cred_id)
        if not existing:
            raise ValueError("Credential not found")
        update_kwargs = {}
        if name is not None:
            update_kwargs["name"] = name
        if username is not None:
            update_kwargs["username"] = username
        if cred_type is not None:
            update_kwargs["type"] = cred_type
        if valid_until is not None:
            update_kwargs["valid_until"] = valid_until
        if source is not None:
            update_kwargs["source"] = source
        if owner is not None:
            update_kwargs["owner"] = owner
        if password is not None:
            update_kwargs["password_encrypted"] = self._get_enc().encrypt(password)
        if ssh_private_key is not None:
            update_kwargs["ssh_key_encrypted"] = self._get_enc().encrypt(
                ssh_private_key
            )
        if ssh_passphrase is not None:
            update_kwargs["ssh_passphrase_encrypted"] = self._get_enc().encrypt(
                ssh_passphrase
            )
        if ssh_keyfile_path is not None:
            update_kwargs["ssh_keyfile_path"] = ssh_keyfile_path or None
        update_kwargs["updated_at"] = datetime.utcnow()
        updated = self.creds_repo.update(cred_id, **update_kwargs)
        final_type = cred_type if cred_type is not None else existing.type
        if final_type == "ssh_key" and ssh_private_key is not None:
            from services.settings.ssh_key_service import SSHKeyService

            SSHKeyService().export_single_ssh_key(cred_id)
        return _credential_to_dict(updated)

    def delete_credential(self, cred_id: int) -> None:
        cred = self.creds_repo.get_by_id(cred_id)
        if cred and cred.type == "ssh_key":
            from services.settings.ssh_key_service import SSHKeyService

            SSHKeyService()._delete_ssh_key_file(cred.name, cred.source, cred.owner)
        self.creds_repo.delete(cred_id)

    def delete_credentials_by_owner(self, owner: str) -> int:
        return self.creds_repo.delete_by_owner(owner)

    def get_decrypted_password(self, cred_id: int) -> str:
        cred = self.creds_repo.get_by_id(cred_id)
        if not cred:
            raise ValueError("Credential not found")
        if not cred.password_encrypted:
            raise ValueError("Credential has no password")
        return self._get_enc().decrypt(cred.password_encrypted)

    def get_decrypted_ssh_key(self, cred_id: int) -> str:
        cred = self.creds_repo.get_by_id(cred_id)
        if not cred:
            raise ValueError("Credential not found")
        if not cred.ssh_key_encrypted:
            raise ValueError("Credential has no SSH key")
        return self._get_enc().decrypt(cred.ssh_key_encrypted)

    def get_decrypted_ssh_passphrase(self, cred_id: int) -> Optional[str]:
        cred = self.creds_repo.get_by_id(cred_id)
        if not cred:
            raise ValueError("Credential not found")
        if not cred.ssh_passphrase_encrypted:
            return None
        return self._get_enc().decrypt(cred.ssh_passphrase_encrypted)

    def has_ssh_key(self, cred_id: int) -> bool:
        cred = self.creds_repo.get_by_id(cred_id)
        if not cred:
            return False
        return cred.ssh_key_encrypted is not None and len(cred.ssh_key_encrypted) > 0

    def get_ssh_key_credentials(self) -> List[Dict[str, Any]]:
        return [_credential_to_dict(c) for c in self.creds_repo.get_by_type("ssh_key")]

    def get_ssh_key_path(self, cred_id: int) -> Optional[str]:
        import re

        cred = self.creds_repo.get_by_id(cred_id)
        if not cred:
            return None
        if cred.type != "ssh_key" or not cred.ssh_key_encrypted:
            return None
        from services.settings.ssh_key_service import SSHKeyService

        ssh_svc = SSHKeyService()
        output_dir = ssh_svc._get_ssh_keys_directory()
        prefix = ssh_svc._get_ssh_key_filename_prefix(cred.source, cred.owner)
        safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
        key_path = os.path.join(output_dir, f"{prefix}{safe_name}")
        if os.path.exists(key_path):
            return key_path
        return ssh_svc.export_single_ssh_key(cred_id)
