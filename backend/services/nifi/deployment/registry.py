"""Registry lookups for NiFi flow deployment."""

import logging
from typing import Optional, Any, Tuple

from nipyapi import versioning

logger = logging.getLogger(__name__)


def get_bucket_and_flow_identifiers(
    bucket_id: str, flow_id: str, registry_client_id: str
) -> Tuple[str, str]:
    """Get bucket and flow identifiers from registry."""
    reg_client = versioning.get_registry_client(registry_client_id, "id")
    reg_client_name = (
        reg_client.component.name
        if hasattr(reg_client, "component")
        else registry_client_id
    )

    is_github_registry = (
        "github" in reg_client_name.lower() if reg_client_name else False
    )

    if is_github_registry:
        logger.info("GitHub registry detected, using provided IDs directly")
        return bucket_id, flow_id

    try:
        bucket = versioning.get_registry_bucket(bucket_id)
        flow = versioning.get_flow_in_bucket(bucket.identifier, identifier=flow_id)
        return bucket.identifier, flow.identifier
    except Exception as lookup_error:
        logger.warning(
            "Could not lookup bucket/flow, using provided values: %s", lookup_error
        )
        return bucket_id, flow_id


def get_deploy_version(
    requested_version: Optional[Any],
    reg_client_id: str,
    bucket_identifier: str,
    flow_identifier: str,
) -> Optional[int]:
    """Determine version to deploy."""
    if requested_version is not None:
        return requested_version

    logger.info("No version specified - fetching latest version explicitly...")
    try:
        flow_versions = versioning.list_flow_versions(
            bucket_id=bucket_identifier,
            flow_id=flow_identifier,
            registry_id=reg_client_id,
            service="nifi",
        )

        if flow_versions and hasattr(
            flow_versions, "versioned_flow_snapshot_metadata_set"
        ):
            versions_list = flow_versions.versioned_flow_snapshot_metadata_set
            if versions_list:
                sorted_versions = sorted(
                    versions_list,
                    key=lambda x: x.versioned_flow_snapshot_metadata.timestamp,
                    reverse=True,
                )
                deploy_version = sorted_versions[
                    0
                ].versioned_flow_snapshot_metadata.version
                logger.info("Latest version selected: %s", deploy_version)
                return deploy_version

    except Exception as version_error:
        logger.warning("Could not fetch latest version: %s", version_error)

    return None
