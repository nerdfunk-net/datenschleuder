"""NiFi registry operations - pure nipyapi logic."""

import logging
from typing import List, Dict, Any, Optional

from nipyapi import versioning
from nipyapi.nifi import FlowApi

logger = logging.getLogger(__name__)


def list_registry_clients() -> List[Dict[str, Any]]:
    """Get list of registry clients configured in NiFi."""
    registry_clients_entity = versioning.list_registry_clients()

    clients_list = []
    if hasattr(registry_clients_entity, "registries") and registry_clients_entity.registries:
        for client in registry_clients_entity.registries:
            client_data = {
                "id": client.id if hasattr(client, "id") else "Unknown",
                "name": (
                    client.component.name
                    if hasattr(client, "component") and hasattr(client.component, "name")
                    else "Unknown"
                ),
                "uri": (
                    client.component.properties.get("url", "N/A")
                    if hasattr(client, "component") and hasattr(client.component, "properties")
                    else "N/A"
                ),
                "description": (
                    client.component.description
                    if hasattr(client, "component") and hasattr(client.component, "description")
                    else ""
                ),
                "type": (
                    client.component.type
                    if hasattr(client, "component") and hasattr(client.component, "type")
                    else "Unknown"
                ),
            }
            clients_list.append(client_data)

    return clients_list


def get_registry_buckets(registry_id: str) -> Dict[str, Any]:
    """Get list of buckets from a specific registry client."""
    registry_clients_entity = versioning.list_registry_clients()
    registry_client = None
    registry_type = "Unknown"

    if hasattr(registry_clients_entity, "registries") and registry_clients_entity.registries:
        for client in registry_clients_entity.registries:
            if client.id == registry_id:
                registry_client = client
                if hasattr(client, "component") and hasattr(client.component, "type"):
                    registry_type = client.component.type
                break

    if not registry_client:
        raise ValueError("Registry client with id '%s' not found" % registry_id)

    flow_api = FlowApi()
    buckets_entity = flow_api.get_buckets(registry_id)

    buckets_list = []
    if hasattr(buckets_entity, "buckets") and buckets_entity.buckets:
        for bucket in buckets_entity.buckets:
            bucket_data = {
                "identifier": bucket.id if hasattr(bucket, "id") else "Unknown",
                "name": (
                    bucket.bucket.name
                    if hasattr(bucket, "bucket") and hasattr(bucket.bucket, "name")
                    else "Unknown"
                ),
                "description": (
                    bucket.bucket.description
                    if hasattr(bucket, "bucket") and hasattr(bucket.bucket, "description")
                    else ""
                ),
                "created_timestamp": (
                    bucket.bucket.created_timestamp
                    if hasattr(bucket, "bucket") and hasattr(bucket.bucket, "created_timestamp")
                    else None
                ),
                "permissions": (
                    bucket.permissions.to_dict()
                    if hasattr(bucket, "permissions") and hasattr(bucket.permissions, "to_dict")
                    else {}
                ),
            }
            buckets_list.append(bucket_data)

    return {
        "buckets": buckets_list,
        "count": len(buckets_list),
        "registry_type": registry_type,
        "registry_id": registry_id,
    }


def get_registry_details(registry_id: str) -> Dict[str, Any]:
    """Get details about a specific registry client."""
    registry_client = versioning.get_registry_client(registry_id, identifier_type="id")

    if not registry_client:
        raise ValueError("Registry client with id '%s' not found" % registry_id)

    registry_name = (
        registry_client.component.name
        if hasattr(registry_client, "component") and hasattr(registry_client.component, "name")
        else "Unknown"
    )
    registry_type = (
        registry_client.component.type
        if hasattr(registry_client, "component") and hasattr(registry_client.component, "type")
        else "Unknown"
    )

    properties = {}
    github_url = None

    if hasattr(registry_client, "component") and hasattr(registry_client.component, "properties"):
        properties = registry_client.component.properties

        if "github" in registry_type.lower():
            repo_owner = properties.get("Repository Owner")
            repo_name = properties.get("Repository Name")
            repo_path = properties.get("Repository Path", "")

            if repo_owner and repo_name:
                github_url = "https://github.com/%s/%s" % (repo_owner, repo_name)
                if repo_path:
                    github_url += "/tree/main/%s" % repo_path

    return {
        "registry_id": registry_id,
        "name": registry_name,
        "type": registry_type,
        "is_github": "github" in registry_type.lower(),
        "github_url": github_url,
        "properties": properties,
    }


def get_bucket_flows(registry_id: str, bucket_id: str) -> Dict[str, Any]:
    """Get list of flows in a specific bucket."""
    flow_api = FlowApi()
    flows_entity = flow_api.get_flows(registry_id, bucket_id)

    flows_list = []
    if hasattr(flows_entity, "versioned_flows") and flows_entity.versioned_flows:
        for flow in flows_entity.versioned_flows:
            vf = flow.versioned_flow if hasattr(flow, "versioned_flow") else None
            if not vf:
                continue
            flow_data = {
                "identifier": getattr(vf, "flow_id", "Unknown"),
                "name": getattr(vf, "flow_name", "Unknown"),
                "description": getattr(vf, "description", ""),
                "bucket_identifier": getattr(vf, "bucket_id", bucket_id),
                "bucket_name": getattr(vf, "bucket_name", ""),
                "created_timestamp": getattr(vf, "created_timestamp", None),
                "modified_timestamp": getattr(vf, "modified_timestamp", None),
                "version_count": getattr(vf, "version_count", 0),
            }
            flows_list.append(flow_data)

    return {
        "flows": flows_list,
        "count": len(flows_list),
        "registry_id": registry_id,
        "bucket_id": bucket_id,
    }


def get_flow_versions(
    registry_id: str, bucket_id: str, flow_id: str
) -> Dict[str, Any]:
    """Get list of all versions for a specific flow."""
    flow_versions = versioning.list_flow_versions(
        bucket_id=bucket_id,
        flow_id=flow_id,
        registry_id=registry_id,
        service="nifi",
    )

    versions_list = []
    if flow_versions and hasattr(flow_versions, "versioned_flow_snapshot_metadata_set"):
        for version_item in flow_versions.versioned_flow_snapshot_metadata_set:
            if hasattr(version_item, "versioned_flow_snapshot_metadata"):
                metadata = version_item.versioned_flow_snapshot_metadata
                version_data = {
                    "version": getattr(metadata, "version", None),
                    "timestamp": getattr(metadata, "timestamp", None),
                    "comments": getattr(metadata, "comments", ""),
                    "author": getattr(metadata, "author", "Unknown"),
                    "bucket_identifier": getattr(metadata, "bucket_identifier", bucket_id),
                    "flow_identifier": getattr(metadata, "flow_identifier", flow_id),
                }
                versions_list.append(version_data)

    versions_list.sort(
        key=lambda x: x["timestamp"] if x["timestamp"] else 0, reverse=True
    )

    return {
        "versions": versions_list,
        "count": len(versions_list),
        "registry_id": registry_id,
        "bucket_id": bucket_id,
        "flow_id": flow_id,
    }
