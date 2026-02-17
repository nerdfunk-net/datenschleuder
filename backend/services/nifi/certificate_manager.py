"""Certificate manager for loading and managing client certificates from YAML config."""

import logging
from pathlib import Path
from typing import List, Optional, Dict
import yaml
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class CertificateConfig(BaseModel):
    """Model for a certificate configuration entry."""

    name: str
    ca_cert_file: str
    cert_file: str
    key_file: str
    password: str


class CertificateManager:
    """Manages client certificates from certificates.yaml."""

    def __init__(self, certs_dir: Optional[Path] = None):
        if certs_dir is None:
            # Default to project_root/certs/
            project_root = Path(__file__).parent.parent.parent.parent
            certs_dir = project_root / "certs"

        self.certs_dir = certs_dir
        self.config_file = certs_dir / "certificates.yaml"
        self._certificates: Optional[List[CertificateConfig]] = None

    def load_certificates(self) -> List[CertificateConfig]:
        """Load certificates from YAML configuration file."""
        if not self.config_file.exists():
            return []

        try:
            with open(self.config_file, "r") as f:
                data = yaml.safe_load(f)

            if not data or "certificates" not in data:
                return []

            certificates = []
            for cert_data in data["certificates"]:
                cert = CertificateConfig(**cert_data)
                certificates.append(cert)

            self._certificates = certificates
            return certificates

        except Exception:
            logger.exception("Error loading certificates from %s", self.config_file)
            return []

    def get_certificates(self) -> List[CertificateConfig]:
        """Get all certificates, loading if not already loaded."""
        if self._certificates is None:
            self._certificates = self.load_certificates()
        return self._certificates

    def get_certificate_by_name(self, name: str) -> Optional[CertificateConfig]:
        """Get a specific certificate by name."""
        certificates = self.get_certificates()
        for cert in certificates:
            if cert.name == name:
                return cert
        return None

    def get_certificate_names(self) -> List[str]:
        """Get list of all certificate names."""
        return [cert.name for cert in self.get_certificates()]

    def get_certificate_paths(self, cert_name: str) -> Optional[Dict[str, Path]]:
        """Get full paths for a certificate's files."""
        cert = self.get_certificate_by_name(cert_name)
        if not cert:
            return None

        return {
            "ca_cert_path": self.certs_dir / cert.ca_cert_file,
            "cert_path": self.certs_dir / cert.cert_file,
            "key_path": self.certs_dir / cert.key_file,
            "password": cert.password,
        }

    def reload(self):
        """Force reload certificates from file."""
        self._certificates = None
        return self.get_certificates()


# Global certificate manager instance
certificate_manager = CertificateManager()
