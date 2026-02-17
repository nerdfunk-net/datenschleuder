"""NiFi connection service for nipyapi configuration.

Supports three authentication methods (in priority order):
1. OIDC (if oidc_provider_id is set)
2. Client certificates (if certificate_name is specified)
3. Username/password (if username is provided)
"""

import ssl
import logging
from pathlib import Path
from typing import Optional, Union

import nipyapi
from nipyapi import config, security

from services.nifi.encryption import encryption_service
from services.nifi.certificate_manager import certificate_manager
from services.nifi.oidc_config import nifi_oidc_config

logger = logging.getLogger(__name__)


class NifiConnectionService:
    """Service for configuring nipyapi connections to NiFi instances."""

    def configure(
        self,
        *,
        nifi_url: str,
        verify_ssl: bool = True,
        username: Optional[str] = None,
        password_encrypted: Optional[bytes] = None,
        certificate_name: Optional[str] = None,
        check_hostname: bool = True,
        oidc_provider_id: Optional[str] = None,
        normalize_url: bool = False,
    ) -> None:
        """Configure nipyapi connection for a NiFi instance."""
        nifi_url = nifi_url.rstrip("/")

        if normalize_url:
            if nifi_url.endswith("/nifi-api"):
                nifi_url = nifi_url[:-9]
            nifi_url = "%s/nifi-api" % nifi_url

        config.nifi_config.host = nifi_url
        config.nifi_config.verify_ssl = verify_ssl

        if not verify_ssl:
            nipyapi.config.disable_insecure_request_warnings = True

        # Priority 1: OIDC Authentication
        if oidc_provider_id and oidc_provider_id.strip():
            logger.info("Using OIDC authentication with provider: %s", oidc_provider_id)
            self._configure_oidc_auth(oidc_provider_id, verify_ssl)
            return

        # Priority 2: Certificate-based Authentication
        if certificate_name and certificate_name.strip():
            logger.info("Using certificate authentication: %s", certificate_name)
            self._configure_certificate_auth(
                certificate_name, verify_ssl, check_hostname
            )
            return

        # Priority 3: Username/Password Authentication
        if username:
            logger.info("Using username/password authentication")
            self._configure_username_auth(username, password_encrypted)
            return

        logger.warning("No authentication method configured for NiFi connection")

    def configure_from_instance(self, instance, normalize_url: bool = False) -> None:
        """Configure from a NifiInstance model object."""
        self.configure(
            nifi_url=instance.nifi_url,
            verify_ssl=instance.verify_ssl,
            username=instance.username,
            password_encrypted=instance.password_encrypted,
            certificate_name=instance.certificate_name,
            check_hostname=instance.check_hostname,
            oidc_provider_id=instance.oidc_provider_id,
            normalize_url=normalize_url,
        )

    def configure_test(
        self,
        *,
        nifi_url: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        verify_ssl: bool = True,
        certificate_name: Optional[str] = None,
        check_hostname: bool = True,
        oidc_provider_id: Optional[str] = None,
    ) -> None:
        """Configure nipyapi for testing (without saving to database)."""
        nifi_url = nifi_url.rstrip("/")

        # Normalize URL: ensure it ends with /nifi-api
        if not nifi_url.endswith("/nifi-api"):
            nifi_url = "%s/nifi-api" % nifi_url

        logger.debug(
            "Configuring test connection: url=%s verify_ssl=%s check_hostname=%s",
            nifi_url, verify_ssl, check_hostname,
        )

        config.nifi_config.host = nifi_url
        config.nifi_config.verify_ssl = verify_ssl

        if not verify_ssl:
            nipyapi.config.disable_insecure_request_warnings = True

        # Priority 1: OIDC Authentication
        if oidc_provider_id and oidc_provider_id.strip():
            logger.debug("Using OIDC authentication with provider: %s", oidc_provider_id)
            self._configure_oidc_auth(oidc_provider_id, verify_ssl)
            return

        # Priority 2: Certificate Authentication
        if certificate_name and certificate_name.strip():
            logger.debug("Using certificate authentication: %s", certificate_name)
            self._configure_certificate_auth(
                certificate_name, verify_ssl, check_hostname
            )
            return

        # Priority 3: Username/Password Authentication
        if username and password:
            logger.debug("Using username/password authentication for user: %s", username)
            config.nifi_config.username = username
            config.nifi_config.password = password
            try:
                security.service_login(service="nifi", username=username, password=password)
            except Exception as e:
                logger.error(
                    "Authentication failed for user '%s' at %s: %s",
                    username, nifi_url, str(e),
                )
                raise
            return

        logger.warning("No authentication method configured for test connection")

    def _configure_oidc_auth(self, provider_id: str, verify_ssl: bool = True) -> None:
        """Configure OIDC authentication using a provider from oidc_providers.yaml."""
        provider_config = nifi_oidc_config.get_oidc_provider(provider_id)
        if not provider_config:
            raise ValueError(
                "OIDC provider '%s' not found in oidc_providers.yaml" % provider_id
            )

        if not provider_config.get("enabled", False):
            raise ValueError(
                "OIDC provider '%s' is not enabled" % provider_id
            )

        discovery_url = provider_config.get("discovery_url")
        if not discovery_url:
            raise ValueError(
                "OIDC provider '%s' missing discovery_url" % provider_id
            )

        token_endpoint = discovery_url
        if "/.well-known/openid-configuration" in token_endpoint:
            token_endpoint = token_endpoint.replace(
                "/.well-known/openid-configuration",
                "/protocol/openid-connect/token",
            )

        client_id = provider_config.get("client_id")
        client_secret = provider_config.get("client_secret")

        if not client_id or not client_secret:
            raise ValueError(
                "OIDC provider '%s' missing client_id or client_secret" % provider_id
            )

        # Resolve ca_cert_path for the OIDC token request.
        # requests.post(verify=...) accepts a CA bundle path string as well as a bool,
        # so we pass the resolved path directly when verify_ssl=True and a cert is configured.
        ssl_verify: Union[bool, str] = verify_ssl
        ca_cert_path = provider_config.get("ca_cert_path")
        if verify_ssl and ca_cert_path:
            workspace_root = Path(__file__).parent.parent.parent.parent
            resolved = workspace_root / ca_cert_path
            if resolved.exists():
                ssl_verify = str(resolved)
                logger.debug(
                    "Using CA cert for OIDC provider '%s': %s", provider_id, ssl_verify
                )
            else:
                logger.warning(
                    "CA cert configured for OIDC provider '%s' but file not found: %s",
                    provider_id, resolved,
                )

        security.service_login_oidc(
            service="nifi",
            oidc_token_endpoint=token_endpoint,
            client_id=client_id,
            client_secret=client_secret,
            verify_ssl=ssl_verify,
        )

        logger.info("Successfully authenticated with OIDC provider: %s", provider_id)

    def _configure_certificate_auth(
        self,
        certificate_name: str,
        verify_ssl: bool = True,
        check_hostname: bool = True,
    ) -> None:
        """Configure certificate-based authentication."""
        cert_paths = certificate_manager.get_certificate_paths(certificate_name)
        if not cert_paths:
            raise ValueError(
                "Certificate '%s' not found in certificates.yaml" % certificate_name
            )

        ca_cert_path = cert_paths["ca_cert_path"]
        cert_path = cert_paths["cert_path"]
        key_path = cert_paths["key_path"]
        key_password = cert_paths["password"]

        if not ca_cert_path.exists():
            raise FileNotFoundError("CA certificate not found: %s" % ca_cert_path)
        if not cert_path.exists():
            raise FileNotFoundError("Client certificate not found: %s" % cert_path)
        if not key_path.exists():
            raise FileNotFoundError("Client key not found: %s" % key_path)

        ssl_context = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH)
        ssl_context.load_cert_chain(
            certfile=str(cert_path),
            keyfile=str(key_path),
            password=key_password,
        )
        ssl_context.load_verify_locations(cafile=str(ca_cert_path))

        if not verify_ssl:
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
        elif not check_hostname:
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_REQUIRED

        config.nifi_config.ssl_context = ssl_context
        logger.info(
            "Successfully configured certificate authentication: %s",
            certificate_name,
        )

    def _configure_username_auth(
        self,
        username: str,
        password_encrypted: Optional[bytes] = None,
    ) -> None:
        """Configure username/password authentication."""
        password = None
        if password_encrypted:
            password = encryption_service.decrypt(password_encrypted)

        if not password:
            logger.warning("Username provided but password is empty")
            return

        config.nifi_config.username = username
        config.nifi_config.password = password
        security.service_login(service="nifi", username=username, password=password)
        logger.info("Successfully authenticated with username: %s", username)


# Global instance
nifi_connection_service = NifiConnectionService()
