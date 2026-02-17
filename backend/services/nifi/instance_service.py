"""Application service for NiFi instance management."""

import logging
from typing import List, Optional

from core.models import NifiInstance
from repositories.nifi.nifi_instance_repository import NifiInstanceRepository
from services.nifi.encryption import encryption_service
from services.nifi.connection import nifi_connection_service
from services.nifi.operations.connections import test_connection

logger = logging.getLogger(__name__)

_repo = NifiInstanceRepository()


def list_instances() -> List[NifiInstance]:
    """Get all NiFi instances."""
    return _repo.get_all_ordered()


def get_instance(instance_id: int) -> Optional[NifiInstance]:
    """Get a specific NiFi instance."""
    return _repo.get_by_id(instance_id)


def create_instance(
    name: Optional[str],
    hierarchy_attribute: str,
    hierarchy_value: str,
    nifi_url: str,
    username: Optional[str] = None,
    password: Optional[str] = None,
    use_ssl: bool = True,
    verify_ssl: bool = True,
    certificate_name: Optional[str] = None,
    check_hostname: bool = True,
    oidc_provider_id: Optional[str] = None,
) -> NifiInstance:
    """Create a new NiFi instance."""
    existing = _repo.get_by_hierarchy(hierarchy_attribute, hierarchy_value)
    if existing:
        raise ValueError(
            "NiFi instance already exists for %s=%s"
            % (hierarchy_attribute, hierarchy_value)
        )

    encrypted_password = None
    if password:
        encrypted_password = encryption_service.encrypt(password)

    return _repo.create(
        name=name,
        hierarchy_attribute=hierarchy_attribute,
        hierarchy_value=hierarchy_value,
        nifi_url=nifi_url,
        username=username,
        password_encrypted=encrypted_password,
        use_ssl=use_ssl,
        verify_ssl=verify_ssl,
        certificate_name=certificate_name,
        check_hostname=check_hostname,
        oidc_provider_id=oidc_provider_id,
    )


def update_instance(instance_id: int, **kwargs) -> Optional[NifiInstance]:
    """Update a NiFi instance."""
    password = kwargs.pop("password", None)
    if password is not None:
        kwargs["password_encrypted"] = encryption_service.encrypt(password)

    return _repo.update(instance_id, **kwargs)


def delete_instance(instance_id: int) -> bool:
    """Delete a NiFi instance."""
    return _repo.delete(instance_id)


def test_instance_connection(instance_id: int) -> dict:
    """Test connection for a saved NiFi instance."""
    instance = _repo.get_by_id(instance_id)
    if not instance:
        raise ValueError("NiFi instance with ID %d not found" % instance_id)

    logger.debug(
        "Testing saved NiFi instance id=%d url=%s", instance_id, instance.nifi_url
    )
    nifi_connection_service.configure_from_instance(instance)
    result = test_connection()
    result["nifi_url"] = instance.nifi_url
    return result


def test_new_connection(
    nifi_url: str,
    username: Optional[str] = None,
    password: Optional[str] = None,
    verify_ssl: bool = True,
    certificate_name: Optional[str] = None,
    check_hostname: bool = True,
    oidc_provider_id: Optional[str] = None,
) -> dict:
    """Test connection with provided credentials (without saving)."""
    logger.debug(
        "Testing new NiFi connection: url=%s username=%s verify_ssl=%s",
        nifi_url, username, verify_ssl,
    )
    nifi_connection_service.configure_test(
        nifi_url=nifi_url,
        username=username,
        password=password,
        verify_ssl=verify_ssl,
        certificate_name=certificate_name,
        check_hostname=check_hostname,
        oidc_provider_id=oidc_provider_id,
    )
    result = test_connection()
    result["nifi_url"] = nifi_url
    return result
