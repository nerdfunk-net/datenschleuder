"""Application service for registry flow management."""

import logging
from typing import List, Optional

from core.models import RegistryFlow
from repositories.nifi.registry_flow_repository import RegistryFlowRepository

logger = logging.getLogger(__name__)

_repo = RegistryFlowRepository()


def list_flows(nifi_instance_id: Optional[int] = None) -> List[RegistryFlow]:
    """List registry flows, optionally filtered by instance."""
    if nifi_instance_id is not None:
        return _repo.get_by_instance(nifi_instance_id)
    return _repo.get_all_ordered()


def get_flow(flow_id: int) -> Optional[RegistryFlow]:
    """Get a specific registry flow."""
    return _repo.get_by_id(flow_id)


def create_flows(flows_data: list) -> dict:
    """Create one or more registry flows, skipping duplicates."""
    created_count = 0
    skipped_count = 0

    for flow_data in flows_data:
        existing = _repo.get_by_flow_id(
            flow_data["nifi_instance_id"],
            flow_data["bucket_id"],
            flow_data["flow_id"],
        )

        if existing:
            skipped_count += 1
            continue

        _repo.create(**flow_data)
        created_count += 1

    return {"created": created_count, "skipped": skipped_count}


def delete_flow(flow_id: int) -> bool:
    """Delete a registry flow."""
    return _repo.delete(flow_id)


def list_templates() -> List[dict]:
    """List all flows formatted for template selection dropdown."""
    flows = _repo.get_all_ordered()
    return [
        {
            "id": flow.id,
            "name": flow.flow_name,
            "label": "%s (%s / %s)" % (flow.flow_name, flow.nifi_instance_name, flow.bucket_name),
            "nifi_instance": flow.nifi_instance_name,
            "bucket": flow.bucket_name,
        }
        for flow in flows
    ]
