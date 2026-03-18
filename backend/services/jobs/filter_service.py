"""Job filter parsing utilities.

De-duplicates comma-separated query parameter parsing used across job routers.
"""

from __future__ import annotations
from typing import Optional


def parse_comma_separated_filters(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    triggered_by: Optional[str] = None,
    template_id: Optional[str] = None,
) -> dict:
    """Parse comma-separated query parameters into filter lists.

    Args:
        status: Comma-separated status values (e.g. "completed,failed").
        job_type: Comma-separated job type values.
        triggered_by: Comma-separated trigger type values.
        template_id: Comma-separated integer template IDs.

    Returns:
        Dict with keys status_list, job_type_list, triggered_by_list, template_id_list.
        Each value is a list or None.
    """
    return {
        "status_list": status.split(",") if status else None,
        "job_type_list": job_type.split(",") if job_type else None,
        "triggered_by_list": triggered_by.split(",") if triggered_by else None,
        "template_id_list": (
            [int(t) for t in template_id.split(",") if t.isdigit()]
            if template_id
            else None
        ),
    }
