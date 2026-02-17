"""OIDC provider configuration reader for NiFi-to-NiFi authentication.

This is separate from user OIDC login - it handles backend-to-NiFi auth
via OIDC providers defined in config/oidc_providers.yaml.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml

logger = logging.getLogger(__name__)


class NifiOidcConfigManager:
    """Manages OIDC provider configuration from YAML file for NiFi auth."""

    def __init__(self, config_path: Optional[str] = None):
        if config_path is None:
            backend_dir = Path(__file__).parent.parent.parent
            workspace_root = backend_dir.parent
            config_path = workspace_root / "config" / "oidc_providers.yaml"

        self.config_path = Path(config_path)
        self._config: Optional[Dict[str, Any]] = None
        self._load_config()

    def _load_config(self) -> None:
        """Load OIDC configuration from YAML file."""
        if not self.config_path.exists():
            logger.warning("OIDC config file not found: %s", self.config_path)
            self._config = {"providers": {}, "global": {}}
            return

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._config = yaml.safe_load(f) or {}

            if "providers" not in self._config:
                self._config["providers"] = {}
            if "global" not in self._config:
                self._config["global"] = {}

            logger.info("Loaded OIDC configuration from %s", self.config_path)

        except Exception:
            logger.exception("Failed to load OIDC configuration")
            self._config = {"providers": {}, "global": {}}

    def reload_config(self) -> None:
        """Reload configuration from file."""
        self._load_config()

    def get_oidc_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """Get configuration for specific OIDC provider."""
        if not self._config:
            return None

        provider_config = self._config.get("providers", {}).get(provider_id)
        if provider_config:
            config = provider_config.copy()
            config["provider_id"] = provider_id
            return config

        return None

    def get_oidc_providers(self) -> List[Dict[str, Any]]:
        """Get all OIDC providers."""
        if not self._config:
            return []

        providers = []
        for provider_id, config in self._config.get("providers", {}).items():
            provider_config = config.copy()
            provider_config["provider_id"] = provider_id
            providers.append(provider_config)

        return sorted(providers, key=lambda p: p.get("display_order", 999))

    def get_backend_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a backend OIDC provider."""
        provider_config = self.get_oidc_provider(provider_id)
        if provider_config and provider_config.get("enabled", False):
            return provider_config
        return None


# Global instance
nifi_oidc_config = NifiOidcConfigManager()
