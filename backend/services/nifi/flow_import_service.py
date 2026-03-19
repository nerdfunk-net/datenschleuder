"""Service for importing NiFi flows from a Git repository file (JSON or CSV)."""

from __future__ import annotations

import csv
import io
import json
import logging
from typing import TYPE_CHECKING

from models.flow_import import FlowImportResponse, FlowImportResultItem
from services.nifi import nifi_flow_service
from services.nifi.hierarchy_service import get_hierarchy_config
from services.settings.git.file_operations_service import GitFileOperationsService

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_file_ops = GitFileOperationsService()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_hierarchy() -> list:
    config = get_hierarchy_config()
    return sorted(config.get("hierarchy", []), key=lambda x: x.get("order", 0))


def _hierarchy_key(hierarchy_values: dict, hierarchy: list) -> tuple:
    """Build a hashable key from all hierarchy attribute source/destination values."""
    return tuple(
        (
            attr["name"],
            hierarchy_values.get(attr["name"], {}).get("source", ""),
            hierarchy_values.get(attr["name"], {}).get("destination", ""),
        )
        for attr in hierarchy
    )


def _build_existing_index(flows: list, hierarchy: list) -> set:
    """Build a set of hierarchy keys for all existing flows (O(1) duplicate check)."""
    index = set()
    for flow in flows:
        hv = flow.get("hierarchy_values") or {}
        index.add(_hierarchy_key(hv, hierarchy))
    return index


def _parse_json_flows(content: str) -> list[dict]:
    """Parse a JSON flow export file.

    Accepts either a list of flow dicts or a dict with a 'flows' key.
    """
    data = json.loads(content)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "flows" in data:
        return data["flows"]
    raise ValueError("JSON file must contain a list of flows or a dict with a 'flows' key")


def _parse_csv_flows(content: str, hierarchy: list) -> list[dict]:
    """Parse a CSV flow export file into a list of flow dicts with hierarchy_values."""
    reader = csv.DictReader(io.StringIO(content))
    rows = []
    for row in reader:
        hierarchy_values = {}
        for attr in hierarchy:
            name = attr["name"]
            name_lower = name.lower()
            hierarchy_values[name] = {
                "source": row.get(f"src_{name_lower}", ""),
                "destination": row.get(f"dest_{name_lower}", ""),
            }
        flow = {
            "hierarchy_values": hierarchy_values,
            "name": row.get("name", ""),
            "contact": row.get("contact", ""),
            "src_connection_param": row.get("src_connection_param", ""),
            "dest_connection_param": row.get("dest_connection_param", ""),
            "active": row.get("active", "true").lower() not in ("false", "0", "no"),
            "description": row.get("description", ""),
        }
        rows.append(flow)
    return rows


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def import_flows_from_repo(
    repo_id: int,
    file_path: str,
    dry_run: bool,
    git_repo_manager,
    current_username: str,
) -> FlowImportResponse:
    """Import flows from a JSON or CSV file in a Git repository.

    Args:
        repo_id: Git repository ID.
        file_path: Relative path to the file within the repository.
        dry_run: When True, compute results without writing to the database.
        git_repo_manager: FastAPI-injected git repo manager.
        current_username: Username of the requesting user (used as creator_name).

    Returns:
        FlowImportResponse with per-row results.
    """
    content = _file_ops.read_file_content(repo_id, file_path, git_repo_manager)
    hierarchy = _get_hierarchy()

    lower_path = file_path.lower()
    if lower_path.endswith(".json"):
        raw_flows = _parse_json_flows(content)
    elif lower_path.endswith(".csv"):
        raw_flows = _parse_csv_flows(content, hierarchy)
    else:
        raise ValueError(f"Unsupported file type: {file_path}. Only .json and .csv are supported.")

    existing_flows = nifi_flow_service.list_flows()
    existing_index: set = _build_existing_index(existing_flows, hierarchy)

    results: list[FlowImportResultItem] = []
    created = skipped = errors = 0

    for idx, flow_dict in enumerate(raw_flows):
        try:
            hierarchy_values = flow_dict.get("hierarchy_values") or {}
            key = _hierarchy_key(hierarchy_values, hierarchy)

            if key in existing_index:
                results.append(
                    FlowImportResultItem(
                        row_index=idx,
                        status="skipped",
                        message="Duplicate: a flow with the same hierarchy values already exists.",
                        flow_data=flow_dict,
                    )
                )
                skipped += 1
                continue

            if not dry_run:
                created_flow = nifi_flow_service.create_flow(
                    hierarchy_values=hierarchy_values,
                    src_connection_param=flow_dict.get("src_connection_param", ""),
                    dest_connection_param=flow_dict.get("dest_connection_param", ""),
                    name=flow_dict.get("name") or None,
                    contact=flow_dict.get("contact") or None,
                    src_template_id=flow_dict.get("src_template_id") or None,
                    dest_template_id=flow_dict.get("dest_template_id") or None,
                    active=bool(flow_dict.get("active", True)),
                    description=flow_dict.get("description") or None,
                    creator_name=current_username,
                )
                # Add to in-memory index to catch intra-file duplicates
                existing_index.add(key)
                results.append(
                    FlowImportResultItem(
                        row_index=idx,
                        status="created",
                        message="Flow created successfully.",
                        flow_data=created_flow,
                    )
                )
            else:
                results.append(
                    FlowImportResultItem(
                        row_index=idx,
                        status="created",
                        message="Flow would be created (dry run).",
                        flow_data=flow_dict,
                    )
                )
                # Track in index so intra-file duplicates are detected in dry run too
                existing_index.add(key)

            created += 1

        except Exception as exc:
            logger.warning("Flow import error at row %d: %s", idx, exc)
            results.append(
                FlowImportResultItem(
                    row_index=idx,
                    status="error",
                    message=str(exc),
                    flow_data=flow_dict,
                )
            )
            errors += 1

    return FlowImportResponse(
        dry_run=dry_run,
        total=len(raw_flows),
        created=created,
        skipped=skipped,
        errors=errors,
        results=results,
    )
