"""Application service for registry flow metadata management."""

import logging
from typing import List

from core.models import RegistryFlowMetadata
from repositories.nifi.registry_flow_metadata_repository import (
    RegistryFlowMetadataRepository,
)

logger = logging.getLogger(__name__)

_repo = RegistryFlowMetadataRepository()


def list_metadata(flow_id: int) -> List[RegistryFlowMetadata]:
    """Return all metadata entries for a registry flow."""
    return _repo.get_by_flow_id(flow_id)


def set_metadata(flow_id: int, items: List[dict]) -> List[RegistryFlowMetadata]:
    """Replace all metadata for a flow (delete existing, insert new)."""
    _repo.delete_by_flow_id(flow_id)
    if not items:
        return []
    return _repo.create_bulk(flow_id, items)
