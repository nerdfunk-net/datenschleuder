"""Template type inference utilities."""

from __future__ import annotations

import os
from typing import Optional, Tuple


def infer_from_extension(
    filename: str,
    default_type: str = "jinja2",
    default_category: Optional[str] = None,
) -> Tuple[str, str]:
    """Infer template_type and category from a filename's extension.

    Args:
        filename: The filename (may include path components).
        default_type: Fallback template type when extension is not recognized.
        default_category: Fallback category when extension is not recognized.

    Returns:
        Tuple of (template_type, category).
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".textfsm":
        return "textfsm", default_category or "parser"
    return default_type, default_category
