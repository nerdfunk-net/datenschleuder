"""
Settings router for application configuration management.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.settings import (
    GitSettingsRequest,
    AllSettingsRequest,
    GitTestRequest,
    CacheSettingsRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_all_settings(
    current_user: dict = Depends(require_permission("settings.common", "read")),
):
    """Get all application settings."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        settings_data = settings_manager.get_all_settings()

        # Check if database was recovered from corruption
        metadata = settings_data.get("metadata", {})
        if metadata.get("status") == "recovered":
            return {
                "settings": settings_data,
                "warning": metadata.get(
                    "message", "Database was recovered from corruption"
                ),
                "recovery_performed": True,
            }

        return {"settings": settings_data}

    except Exception as e:
        logger.error("Error getting settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve settings: {str(e)}",
        )


@router.get("/git")
def get_git_settings(
    current_user: dict = Depends(require_permission("settings.git", "read")),
):
    """Get Git settings."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        git_settings = settings_manager.get_git_settings()
        return {"success": True, "data": git_settings}

    except Exception as e:
        logger.error("Error getting Git settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to retrieve Git settings: {str(e)}",
        }


@router.get("/cache")
def get_cache_settings(
    current_user: dict = Depends(require_permission("settings.cache", "read")),
):
    """Get Cache settings."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        cache_settings = settings_manager.get_cache_settings()
        return {"success": True, "data": cache_settings}
    except Exception as e:
        logger.error("Error getting Cache settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to retrieve Cache settings: {str(e)}",
        }


@router.put("/cache")
def update_cache_settings(
    cache_request: CacheSettingsRequest,
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Update Cache settings."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        success = settings_manager.update_cache_settings(cache_request.dict())
        if success:
            updated = settings_manager.get_cache_settings()
            return {
                "success": True,
                "message": "Cache settings updated successfully",
                "data": updated,
                "cache": updated,  # backward compatibility
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Cache settings",
            )
    except Exception as e:
        logger.error("Error updating Cache settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Cache settings: {str(e)}",
        )


@router.post("/cache")
def create_cache_settings(
    cache_request: CacheSettingsRequest,
    current_user: dict = Depends(require_permission("settings.cache", "write")),
):
    """Create/Update Cache settings via POST."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        success = settings_manager.update_cache_settings(cache_request.dict())
        if success:
            updated = settings_manager.get_cache_settings()
            return {
                "success": True,
                "message": "Cache settings updated successfully",
                "data": updated,
                "cache": updated,  # backward compatibility
            }
        else:
            return {"success": False, "message": "Failed to update Cache settings"}
    except Exception as e:
        logger.error("Error updating Cache settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to update Cache settings: {str(e)}",
        }


@router.put("")
def update_all_settings(
    settings_request: AllSettingsRequest,
    current_user: dict = Depends(require_permission("settings.common", "write")),
):
    """Update all application settings."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        settings_dict = {
            "git": settings_request.git.dict(),
        }
        if settings_request.cache is not None:
            settings_dict["cache"] = settings_request.cache.dict()

        success = settings_manager.update_all_settings(settings_dict)

        if success:
            return {
                "message": "Settings updated successfully",
                "settings": settings_manager.get_all_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update settings",
            )

    except Exception as e:
        logger.error("Error updating settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}",
        )


@router.put("/git")
def update_git_settings(
    git_request: GitSettingsRequest,
    current_user: dict = Depends(require_permission("settings.git", "write")),
):
    """Update Git settings."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        success = settings_manager.update_git_settings(git_request.dict())

        if success:
            return {
                "message": "Git settings updated successfully",
                "git": settings_manager.get_git_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Git settings",
            )

    except Exception as e:
        logger.error("Error updating Git settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Git settings: {str(e)}",
        )


@router.post("/git")
def create_git_settings(
    git_request: GitSettingsRequest,
    current_user: dict = Depends(require_permission("settings.git", "write")),
):
    """Create/Update Git settings via POST."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        success = settings_manager.update_git_settings(git_request.dict())

        if success:
            return {
                "success": True,
                "message": "Git settings updated successfully",
                "data": settings_manager.get_git_settings(),
            }
        else:
            return {"success": False, "message": "Failed to update Git settings"}

    except Exception as e:
        logger.error("Error updating Git settings: %s", e)
        return {"success": False, "message": f"Failed to update Git settings: {str(e)}"}


@router.post("/test/git")
async def test_git_connection(
    test_request: GitTestRequest,
    current_user: dict = Depends(require_permission("settings.git", "write")),
):
    """Test Git connection with provided settings."""
    try:
        from connection_tester import connection_tester

        success, message = await connection_tester.test_git_connection(
            test_request.dict()
        )

        return {
            "success": success,
            "message": message,
            "tested_repo": test_request.repo_url,
            "tested_branch": test_request.branch,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error("Error testing Git connection: %s", e)
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "tested_repo": test_request.repo_url,
            "tested_branch": test_request.branch,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.post("/reset")
def reset_settings_to_defaults(
    current_user: dict = Depends(require_permission("settings.common", "write")),
):
    """Reset all settings to default values."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        success = settings_manager.reset_to_defaults()

        if success:
            return {
                "message": "Settings reset to defaults successfully",
                "settings": settings_manager.get_all_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset settings to defaults",
            )

    except Exception as e:
        logger.error("Error resetting settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset settings: {str(e)}",
        )


@router.get("/health")
def check_settings_health(
    current_user: dict = Depends(require_permission("settings.common", "write")),
):
    """Check settings database health."""
    try:
        from services.settings.settings_service import (
            settings_service as settings_manager,
        )

        health_info = settings_manager.health_check()

        if health_info["status"] == "healthy":
            return health_info
        else:
            # Database is unhealthy, try to recover
            recovery_result = settings_manager._handle_database_corruption()
            return {
                **health_info,
                "recovery_attempted": True,
                "recovery_result": recovery_result,
            }

    except Exception as e:
        logger.error("Settings health check failed: %s", e)
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# Legacy template settings endpoints for backward compatibility
@router.get("/templates")
def get_template_settings(
    current_user: dict = Depends(require_permission("settings.common", "write")),
):
    """Get template settings (legacy endpoint - redirects to new template management)."""
    return {
        "message": "Template settings have been moved to /api/templates",
        "redirect_url": "/api/templates",
        "legacy": True,
    }


@router.post("/templates")
def update_template_settings(
    template_data: dict,
    current_user: dict = Depends(require_permission("settings.common", "write")),
):
    """Update template settings (legacy endpoint - redirects to new template management)."""
    return {
        "message": "Template settings have been moved to /api/templates",
        "redirect_url": "/api/templates",
        "legacy": True,
        "note": "Please use the new template management interface",
    }
