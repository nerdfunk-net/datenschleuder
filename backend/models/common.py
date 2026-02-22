"""
Standard API response envelope.

All new endpoints should return one of these models instead of ad-hoc dicts.
Existing endpoints will be migrated incrementally — changing a response shape
is a breaking change for the frontend and requires coordinated updates.

Usage:
    from models.common import ApiResponse

    # Success with data
    return ApiResponse(success=True, data=result)

    # Success with message only
    return ApiResponse(success=True, message="Resource deleted")

    # Errors should use HTTPException — do NOT return ApiResponse(success=False).
    # An unsuccessful HTTP status code is clearer than a 200 with success=False.
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """Standard response envelope for API endpoints.

    Fields:
        success:  Always True for 2xx responses (errors use HTTPException).
        data:     The primary payload, if any.
        message:  Human-readable description of the result.
    """

    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
