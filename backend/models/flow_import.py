"""Pydantic models for the flow import feature."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class FlowImportRequest(BaseModel):
    repo_id: int
    file_path: str
    dry_run: bool = False


class FlowImportResultItem(BaseModel):
    row_index: int
    status: Literal["created", "skipped", "error"]
    message: str
    flow_data: Optional[dict] = None


class FlowImportResponse(BaseModel):
    dry_run: bool
    total: int
    created: int
    skipped: int
    errors: int
    results: List[FlowImportResultItem]
