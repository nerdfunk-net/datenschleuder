"""SSH key filesystem export service.

Handles exporting SSH credentials to the filesystem.
"""

from __future__ import annotations
import logging
import os
import re
from typing import List, Optional
from config import settings as config_settings

logger = logging.getLogger(__name__)


class SSHKeyService:
    def _get_ssh_keys_directory(self) -> str:
        return os.path.join(config_settings.data_directory, "ssh_keys")

    def _get_ssh_key_filename_prefix(self, source: str, owner: Optional[str] = None) -> str:
        if source == "general":
            return "global_"
        elif source == "private" and owner:
            safe_owner = re.sub(r"[^a-zA-Z0-9_-]", "_", owner)
            return f"{safe_owner}_"
        elif source == "private":
            return "private_"
        return ""

    def _delete_ssh_key_file(self, cred_name: str, source: str, owner: Optional[str] = None) -> bool:
        output_dir = self._get_ssh_keys_directory()
        prefix = self._get_ssh_key_filename_prefix(source, owner)
        safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred_name)
        key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")
        try:
            if os.path.exists(key_filename):
                os.remove(key_filename)
                logger.info("Deleted SSH key file: %s", key_filename)
                return True
            return False
        except Exception as e:
            logger.error("Failed to delete SSH key file '%s': %s", key_filename, e)
            return False

    def export_single_ssh_key(self, cred_id: int) -> Optional[str]:
        from repositories import CredentialsRepository
        from services.settings.credentials_service import EncryptionService, _build_key
        creds_repo = CredentialsRepository()
        cred = creds_repo.get_by_id(cred_id)
        if not cred:
            logger.warning("Credential with ID %s not found", cred_id)
            return None
        if cred.type != "ssh_key" or not cred.ssh_key_encrypted:
            logger.debug("Credential '%s' is not an SSH key or has no key data", cred.name)
            return None
        output_dir = self._get_ssh_keys_directory()
        os.makedirs(output_dir, exist_ok=True)
        try:
            enc = EncryptionService()
            ssh_key_content = enc.decrypt(cred.ssh_key_encrypted)
            prefix = self._get_ssh_key_filename_prefix(cred.source, cred.owner)
            safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
            key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")
            with open(key_filename, "w") as f:
                f.write(ssh_key_content)
                if not ssh_key_content.endswith("\n"):
                    f.write("\n")
            os.chmod(key_filename, 0o600)
            logger.info("Exported SSH key '%s' to %s", cred.name, key_filename)
            return key_filename
        except Exception as e:
            logger.error("Failed to export SSH key '%s': %s", cred.name, e)
            return None

    def export_ssh_keys_to_filesystem(self, output_dir: Optional[str] = None) -> List[str]:
        from repositories import CredentialsRepository
        from services.settings.credentials_service import EncryptionService
        if output_dir is None:
            output_dir = self._get_ssh_keys_directory()
        os.makedirs(output_dir, exist_ok=True)
        exported_files = []
        creds_repo = CredentialsRepository()
        ssh_key_creds = creds_repo.get_by_type("ssh_key")
        enc = EncryptionService()
        for cred in ssh_key_creds:
            if not cred.ssh_key_encrypted:
                logger.warning("SSH key credential '%s' has no key data, skipping", cred.name)
                continue
            try:
                ssh_key_content = enc.decrypt(cred.ssh_key_encrypted)
                prefix = self._get_ssh_key_filename_prefix(cred.source, cred.owner)
                safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
                key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")
                with open(key_filename, "w") as f:
                    f.write(ssh_key_content)
                    if not ssh_key_content.endswith("\n"):
                        f.write("\n")
                os.chmod(key_filename, 0o600)
                exported_files.append(key_filename)
                logger.info("Exported SSH key '%s' to %s", cred.name, key_filename)
            except Exception as e:
                logger.error("Failed to export SSH key '%s': %s", cred.name, e)
        return exported_files
