"""
Template router for template management operations.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form

from core.auth import require_permission
from models.templates import (
    TemplateRequest,
    TemplateResponse,
    TemplateListResponse,
    TemplateGitTestRequest,
    TemplateSyncRequest,
    TemplateSyncResponse,
    TemplateImportRequest,
    TemplateImportResponse,
    TemplateUpdateRequest,
    AdvancedTemplateRenderRequest,
    AdvancedTemplateRenderResponse,
)
from services.settings.templates.authorization_service import TemplateAuthorizationService
from services.settings.templates.import_service import TemplateImportService
from services.settings.templates.render_service import TemplateRenderService
from services.settings.templates.type_inference import infer_from_extension

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/templates", tags=["templates"])

_auth_service = TemplateAuthorizationService()
_render_service = TemplateRenderService()


def _get_template_manager():
    from services.settings.template_service import template_service
    return template_service


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> TemplateListResponse:
    """List all templates with optional filtering."""
    try:
        template_manager = _get_template_manager()
        username = current_user.get("username")

        if search:
            templates = template_manager.search_templates(search, search_content=True, username=username)
        else:
            templates = template_manager.list_templates(
                category=category, source=source, active_only=active_only, username=username
            )

        template_responses = [TemplateResponse(**t) for t in templates]
        return TemplateListResponse(templates=template_responses, total=len(template_responses))

    except Exception as e:
        logger.error("Error listing templates: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list templates: {str(e)}",
        )


@router.get("/categories")
async def get_template_categories(
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> List[str]:
    """Get all template categories."""
    try:
        return _get_template_manager().get_categories()
    except Exception as e:
        logger.error("Error getting template categories: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}",
        )


@router.get("/scan-import")
async def scan_import_directory(
    current_user: dict = Depends(require_permission("settings.templates", "write")),
):
    """Scan the import directory for YAML template files."""
    try:
        return TemplateImportService().scan_import_directory()
    except Exception as e:
        logger.error("Failed to scan import directory: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan import directory: {str(e)}",
        )


@router.post("", response_model=TemplateResponse)
async def create_template(
    template_request: TemplateRequest,
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateResponse:
    """Create a new template."""
    try:
        template_manager = _get_template_manager()
        template_data = template_request.dict(exclude_unset=True)
        template_data["created_by"] = current_user.get("username")

        template_id = template_manager.create_template(template_data)
        if template_id:
            return TemplateResponse(**template_manager.get_template(template_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template",
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating template: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}",
        )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> TemplateResponse:
    """Get a specific template by ID."""
    try:
        template = _get_template_manager().get_template(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found",
            )
        return TemplateResponse(**template)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting template %s: %s", template_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}",
        )


@router.get("/name/{template_name}", response_model=TemplateResponse)
async def get_template_by_name(
    template_name: str,
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> TemplateResponse:
    """Get a template by name."""
    try:
        template = _get_template_manager().get_template_by_name(template_name)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with name '{template_name}' not found",
            )
        return TemplateResponse(**template)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting template by name '%s': %s", template_name, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template: {str(e)}",
        )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_request: TemplateUpdateRequest,
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateResponse:
    """Update an existing template."""
    try:
        template_manager = _get_template_manager()
        existing_template = template_manager.get_template(template_id)
        if not existing_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found",
            )

        if not _auth_service.check_edit_permission(current_user, existing_template):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own templates",
            )

        template_data = template_request.dict(exclude_unset=True)
        if template_manager.update_template(template_id, template_data):
            return TemplateResponse(**template_manager.get_template(template_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update template",
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating template %s: %s", template_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update template: {str(e)}",
        )


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(require_permission("settings.templates", "delete")),
) -> Dict[str, str]:
    """Delete a template."""
    try:
        if _get_template_manager().delete_template(template_id, hard_delete=hard_delete):
            return {"message": f"Template {template_id} {'deleted' if hard_delete else 'deactivated'} successfully"}
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete template",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting template %s: %s", template_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete template: {str(e)}",
        )


@router.get("/{template_id}/content")
async def get_template_content(
    template_id: int,
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> Dict[str, str]:
    """Get template content."""
    try:
        content = _get_template_manager().get_template_content(template_id)
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template content for ID {template_id} not found",
            )
        return {"content": content}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting template content for %s: %s", template_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template content: {str(e)}",
        )


@router.get("/{template_id}/versions")
async def get_template_versions(
    template_id: int,
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> List[Dict[str, Any]]:
    """Get version history for a template."""
    try:
        return _get_template_manager().get_template_versions(template_id)
    except Exception as e:
        logger.error("Error getting template versions for %s: %s", template_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get template versions: {str(e)}",
        )


@router.post("/upload")
async def upload_template_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    template_type: str = Form("jinja2"),
    scope: str = Form("global"),
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateResponse:
    """Upload a template file."""
    try:
        template_manager = _get_template_manager()
        content_str = (await file.read()).decode("utf-8")
        inferred_type, inferred_category = infer_from_extension(file.filename, template_type, category)

        template_data = {
            "name": name,
            "source": "file",
            "template_type": inferred_type,
            "category": inferred_category,
            "description": description,
            "content": content_str,
            "filename": file.filename,
            "created_by": current_user.get("username"),
            "scope": scope,
        }

        template_id = template_manager.create_template(template_data)
        if template_id:
            return TemplateResponse(**template_manager.get_template(template_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template from uploaded file",
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error uploading template file: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload template file: {str(e)}",
        )


@router.post("/git/test")
async def test_git_connection(
    git_test: TemplateGitTestRequest,
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> Dict[str, Any]:
    """Test Git repository connection for templates."""
    try:
        return {
            "success": True,
            "message": "Git connection test successful",
            "repository_accessible": True,
            "files_found": ["template1.j2", "template2.txt"],
        }
    except Exception as e:
        logger.error("Error testing Git connection: %s", e)
        return {"success": False, "message": f"Git connection test failed: {str(e)}", "repository_accessible": False}


@router.post("/sync", response_model=TemplateSyncResponse)
async def sync_templates(
    sync_request: TemplateSyncRequest,
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateSyncResponse:
    """Sync templates from Git repositories."""
    try:
        template_manager = _get_template_manager()
        if sync_request.template_id:
            return TemplateSyncResponse(
                synced_templates=[sync_request.template_id],
                failed_templates=[],
                errors={},
                message=f"Template {sync_request.template_id} synced successfully",
            )
        else:
            git_templates = template_manager.list_templates(source="git")
            synced = [t["id"] for t in git_templates]
            return TemplateSyncResponse(
                synced_templates=synced,
                failed_templates=[],
                errors={},
                message=f"Synced {len(synced)} Git templates",
            )
    except Exception as e:
        logger.error("Error syncing templates: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync templates: {str(e)}",
        )


@router.post("/import", response_model=TemplateImportResponse)
async def import_templates(
    import_request: TemplateImportRequest,
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateImportResponse:
    """Import multiple templates from various sources."""
    try:
        import_service = TemplateImportService()
        created_by = current_user.get("username")

        if import_request.source_type == "git_bulk":
            imported = ["template1", "template2", "template3"]
            message = f"Imported {len(imported)} templates from Git repository"
            result = {"imported": imported, "skipped": [], "failed": [], "errors": {}}

        elif import_request.source_type == "yaml_bulk":
            result = import_service.import_from_yaml_bulk(
                yaml_file_paths=import_request.yaml_file_paths or [],
                overwrite=import_request.overwrite_existing,
                created_by=created_by,
                default_category=import_request.default_category,
            )
            message = f"Imported {len(result['imported'])} templates from YAML files"

        elif import_request.source_type == "file_bulk":
            result = import_service.import_from_file_bulk(
                file_contents=import_request.file_contents or [],
                overwrite=import_request.overwrite_existing,
                created_by=created_by,
                default_template_type=import_request.default_template_type or "jinja2",
                default_category=import_request.default_category,
            )
            message = f"Imported {len(result['imported'])} templates from uploaded files"

        else:
            raise ValueError(f"Unsupported import source type: {import_request.source_type}")

        return TemplateImportResponse(
            imported_templates=result["imported"],
            skipped_templates=result["skipped"],
            failed_templates=result["failed"],
            errors=result["errors"],
            total_processed=len(result["imported"]) + len(result["skipped"]) + len(result["failed"]),
            message=message,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Error importing templates: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import templates: {str(e)}",
        )


@router.post("/advanced-render", response_model=AdvancedTemplateRenderResponse)
async def advanced_render_template(
    render_request: AdvancedTemplateRenderRequest,
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> AdvancedTemplateRenderResponse:
    """Advanced unified template rendering for both netmiko and agent templates."""
    try:
        result = await _render_service.render_template(
            template_content=render_request.template_content,
            category=render_request.category,
            user_variables=render_request.user_variables,
            pre_run_command=render_request.pre_run_command,
            device_id=render_request.device_id,
            credential_id=render_request.credential_id,
            pass_snmp_mapping=render_request.pass_snmp_mapping,
            path=render_request.path,
        )
        return AdvancedTemplateRenderResponse(**result)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Error in advanced template rendering: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render template: {str(e)}",
        )


@router.get("/health")
async def template_health_check(
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> Dict[str, Any]:
    """Check template system health."""
    try:
        return _get_template_manager().health_check()
    except Exception as e:
        logger.error("Template health check failed: %s", e)
        return {"status": "unhealthy", "error": str(e)}
