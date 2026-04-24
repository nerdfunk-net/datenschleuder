"""OIDC configuration service.

Reads OIDC provider configuration from YAML file.
No database dependency.
"""

from __future__ import annotations
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

logger = logging.getLogger(__name__)


class OIDCConfigService:
    def get_oidc_providers_config_path(self) -> str:
        config_path = (
            Path(__file__).parent.parent.parent.parent
            / "config"
            / "oidc_providers.yaml"
        )
        return str(config_path)

    def load_oidc_providers(self) -> Dict[str, Any]:
        config_path = self.get_oidc_providers_config_path()
        if not os.path.exists(config_path):
            logger.warning("OIDC providers config not found at %s", config_path)
            return {"providers": {}, "global": {"allow_traditional_login": True}}
        try:
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)
            if not config:
                logger.warning("OIDC providers config is empty")
                return {"providers": {}, "global": {"allow_traditional_login": True}}
            if "providers" not in config:
                config["providers"] = {}
            if "global" not in config:
                config["global"] = {"allow_traditional_login": True}
            logger.info(
                "Loaded %s OIDC provider(s) from config",
                len(config.get("providers", {})),
            )
            return config
        except yaml.YAMLError as e:
            logger.error("Error parsing OIDC providers YAML: %s", e)
            return {"providers": {}, "global": {"allow_traditional_login": True}}
        except Exception as e:
            logger.error("Error loading OIDC providers config: %s", e)
            return {"providers": {}, "global": {"allow_traditional_login": True}}

    def get_oidc_providers(self) -> Dict[str, Dict[str, Any]]:
        return self.load_oidc_providers().get("providers", {})

    def get_enabled_oidc_providers(self) -> List[Dict[str, Any]]:
        providers = self.get_oidc_providers()
        enabled_providers = []
        for provider_id, provider_config in providers.items():
            if provider_config.get("enabled", False) and not provider_config.get(
                "backend", False
            ):
                provider_data = provider_config.copy()
                provider_data["provider_id"] = provider_id
                enabled_providers.append(provider_data)
        enabled_providers.sort(key=lambda p: p.get("display_order", 999))
        logger.info(
            "Found %s enabled user-facing OIDC provider(s)", len(enabled_providers)
        )
        return enabled_providers

    def get_nifi_oidc_providers(self) -> List[Dict[str, Any]]:
        providers = self.get_oidc_providers()
        nifi_providers = []
        for provider_id, provider_config in providers.items():
            if provider_config.get("enabled", False) and provider_config.get(
                "backend", False
            ):
                provider_data = provider_config.copy()
                provider_data["provider_id"] = provider_id
                nifi_providers.append(provider_data)
        nifi_providers.sort(key=lambda p: p.get("display_order", 999))
        logger.info(
            "Found %s enabled NiFi backend OIDC provider(s)", len(nifi_providers)
        )
        return nifi_providers

    def get_oidc_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        providers = self.get_oidc_providers()
        provider = providers.get(provider_id)
        if provider:
            provider_data = provider.copy()
            provider_data["provider_id"] = provider_id
            return provider_data
        logger.warning("OIDC provider '%s' not found in config", provider_id)
        return None

    def get_oidc_global_settings(self) -> Dict[str, Any]:
        return self.load_oidc_providers().get(
            "global", {"allow_traditional_login": True}
        )

    def is_oidc_enabled(self) -> bool:
        return len(self.get_enabled_oidc_providers()) > 0
