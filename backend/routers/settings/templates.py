"""
Template router for template management operations.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
import os

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
    ImportableTemplateInfo,
    TemplateScanImportResponse,
    AdvancedTemplateRenderRequest,
    AdvancedTemplateRenderResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(require_permission("settings.templates", "read")),
) -> TemplateListResponse:
    """List all templates with optional filtering.

    Returns global templates and user's private templates.
    """
    try:
        from template_manager import template_manager

        logger.info("DEBUG: API list_templates - current_user dict: %s", current_user)
        username = current_user.get("username")  # Get username from current_user
        logger.info("DEBUG: API list_templates - extracted username: %s", username)

        if search:
            logger.info(
                "DEBUG: API list_templates - using search with username=%s", username
            )
            templates = template_manager.search_templates(
                search, search_content=True, username=username
            )
        else:
            logger.info(
                "DEBUG: API list_templates - calling list_templates with username=%s", username
            )
            templates = template_manager.list_templates(
                category=category,
                source=source,
                active_only=active_only,
                username=username,
            )

        # Convert to response models
        logger.info(
            "DEBUG: API list_templates - received %s templates from manager", len(templates)
        )
        template_responses = []
        for template in templates:
            logger.info(
                "DEBUG: API list_templates - converting template id=%s, name=%s, scope=%s", template['id'], template['name'], template.get('scope')
            )
            template_responses.append(TemplateResponse(**template))

        logger.info(
            "DEBUG: API list_templates - returning %s templates to frontend", len(template_responses)
        )
        return TemplateListResponse(
            templates=template_responses, total=len(template_responses)
        )

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
        from template_manager import template_manager

        return template_manager.get_categories()

    except Exception as e:
        logger.error("Error getting template categories: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get categories: {str(e)}",
        )


@router.get("/scan-import", response_model=TemplateScanImportResponse)
async def scan_import_directory(
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateScanImportResponse:
    """Scan the import directory for YAML template files."""
    try:
        import yaml
        from pathlib import Path

        # Import directory path
        import_dir = Path("../contributing-data")
        if not import_dir.exists():
            return TemplateScanImportResponse(
                templates=[], total_found=0, message="Import directory not found"
            )

        templates = []
        yaml_files = list(import_dir.glob("*.yaml")) + list(import_dir.glob("*.yml"))

        for yaml_file in yaml_files:
            try:
                with open(yaml_file, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)

                # Extract template information from YAML
                if isinstance(data, dict):
                    # Check if it's the expected import format with properties
                    if "properties" in data and isinstance(data["properties"], dict):
                        props = data["properties"]
                        source_value = props.get("source", "file")
                        print(
                            f"DEBUG: Processing {yaml_file.name} - source from props: {source_value}"
                        )
                        template_info = ImportableTemplateInfo(
                            name=props.get("name", yaml_file.stem),
                            description=props.get(
                                "description", "No description available"
                            ),
                            category=props.get("category", "default"),
                            source=source_value,
                            file_path=str(yaml_file.absolute()),
                            template_type=props.get(
                                "type", props.get("template_type", "jinja2")
                            ),
                        )
                    else:
                        # Fallback for direct format (properties at root level)
                        source_value = data.get("source", "file")
                        print(
                            f"DEBUG: Processing {yaml_file.name} - source from root: {source_value}"
                        )
                        template_info = ImportableTemplateInfo(
                            name=data.get("name", yaml_file.stem),
                            description=data.get(
                                "description", "No description available"
                            ),
                            category=data.get("category", "default"),
                            source=source_value,
                            file_path=str(yaml_file.absolute()),
                            template_type=data.get("template_type", "jinja2"),
                        )
                    print(
                        f"DEBUG: Created template_info for {yaml_file.name}: source={template_info.source}"
                    )
                    templates.append(template_info)
            except Exception as e:
                logger.warning("Failed to parse %s: %s", yaml_file, str(e))
                continue

        return TemplateScanImportResponse(
            templates=templates,
            total_found=len(templates),
            message=f"Found {len(templates)} importable templates",
        )

    except Exception as e:
        logger.error("Failed to scan import directory: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan import directory: {str(e)}",
        )


@router.post("", response_model=TemplateResponse)
async def create_template(
    template_request: TemplateRequest,
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateResponse:
    """Create a new template. Requires write permission."""
    try:
        from template_manager import template_manager

        username = current_user.get("username")  # Get username from current_user

        template_data = template_request.dict(exclude_unset=True)
        # Set created_by to the current user
        template_data["created_by"] = username

        template_id = template_manager.create_template(template_data)

        if template_id:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template",
            )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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
        from template_manager import template_manager

        template = template_manager.get_template(template_id)
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
        from template_manager import template_manager

        template = template_manager.get_template_by_name(template_name)
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
    """Update an existing template. Requires write permission."""
    try:
        from template_manager import template_manager

        # Get the existing template to check ownership
        existing_template = template_manager.get_template(template_id)
        if not existing_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found",
            )

        # Check permissions: users can only edit their own templates, admins can edit all
        username = current_user.get("username")
        is_admin = current_user.get("permissions", 0) & 16  # Check admin permission bit

        if not is_admin and existing_template.get("created_by") != username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own templates",
            )

        template_data = template_request.dict(exclude_unset=True)
        logger.info(
            "DEBUG: API update_template(%s) - received data: %s", template_id, template_data
        )
        logger.info(
            "DEBUG: API update_template(%s) - scope in data: %s", template_id, template_data.get('scope')
        )
        success = template_manager.update_template(template_id, template_data)

        if success:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update template",
            )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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
        from template_manager import template_manager

        success = template_manager.delete_template(template_id, hard_delete=hard_delete)

        if success:
            return {
                "message": f"Template {template_id} {'deleted' if hard_delete else 'deactivated'} successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete template",
            )

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
        from template_manager import template_manager

        content = template_manager.get_template_content(template_id)
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
        from template_manager import template_manager

        versions = template_manager.get_template_versions(template_id)
        return versions

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
        from template_manager import template_manager

        username = current_user.get("username")  # Get username from current_user

        # Read file content
        content = await file.read()
        content_str = content.decode("utf-8")

        # Determine type/category based on filename
        ext = os.path.splitext(file.filename)[1].lower()
        inferred_type = template_type
        inferred_category = category
        if ext == ".textfsm":
            inferred_type = "textfsm"
            inferred_category = category or "parser"

        # Create template data
        template_data = {
            "name": name,
            "source": "file",
            "template_type": inferred_type,
            "category": inferred_category,
            "description": description,
            "content": content_str,
            "filename": file.filename,
            "created_by": username,
            "scope": scope,
        }

        template_id = template_manager.create_template(template_data)

        if template_id:
            template = template_manager.get_template(template_id)
            return TemplateResponse(**template)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template from uploaded file",
            )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
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
        # TODO: Implement Git connection testing
        # For now, return a mock response
        return {
            "success": True,
            "message": "Git connection test successful",
            "repository_accessible": True,
            "files_found": ["template1.j2", "template2.txt"],
        }

    except Exception as e:
        logger.error("Error testing Git connection: %s", e)
        return {
            "success": False,
            "message": f"Git connection test failed: {str(e)}",
            "repository_accessible": False,
        }


@router.post("/sync", response_model=TemplateSyncResponse)
async def sync_templates(
    sync_request: TemplateSyncRequest,
    current_user: dict = Depends(require_permission("settings.templates", "write")),
) -> TemplateSyncResponse:
    """Sync templates from Git repositories."""
    try:
        from template_manager import template_manager

        # TODO: Implement Git template synchronization
        # For now, return a mock response

        if sync_request.template_id:
            # Sync specific template
            synced_templates = [sync_request.template_id]
            failed_templates = []
            errors = {}
            message = f"Template {sync_request.template_id} synced successfully"
        else:
            # Sync all Git templates
            git_templates = template_manager.list_templates(source="git")
            synced_templates = [t["id"] for t in git_templates]
            failed_templates = []
            errors = {}
            message = f"Synced {len(synced_templates)} Git templates"

        return TemplateSyncResponse(
            synced_templates=synced_templates,
            failed_templates=failed_templates,
            errors=errors,
            message=message,
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
        from template_manager import template_manager

        imported_templates = []
        skipped_templates = []
        failed_templates = []
        errors = {}

        # TODO: Implement template import functionality
        # For now, return a mock response

        if import_request.source_type == "git_bulk":
            # Import from Git repository
            imported_templates = ["template1", "template2", "template3"]
            message = (
                f"Imported {len(imported_templates)} templates from Git repository"
            )
        elif import_request.source_type == "yaml_bulk":
            # Import from YAML files
            import yaml

            if import_request.yaml_file_paths:
                for yaml_path in import_request.yaml_file_paths:
                    try:
                        print(f"Processing YAML file: {yaml_path}")

                        # Read and parse YAML file
                        with open(yaml_path, "r", encoding="utf-8") as f:
                            yaml_data = yaml.safe_load(f)

                        print(f"YAML data: {yaml_data}")

                        # Extract template info from YAML
                        template_path = yaml_data.get("path", "")
                        properties = yaml_data.get("properties", {})

                        if not template_path:
                            failed_templates.append(yaml_path)
                            errors[yaml_path] = "No template path specified in YAML"
                            continue

                        # Make path absolute - the path in YAML is relative to project root
                        if not os.path.isabs(template_path):
                            # Get the project root (go up from backend/routers/ to project root)
                            current_file = os.path.abspath(__file__)
                            routers_dir = os.path.dirname(
                                current_file
                            )  # backend/routers
                            backend_dir = os.path.dirname(routers_dir)  # backend
                            project_root = os.path.dirname(backend_dir)  # project root
                            template_path = os.path.join(project_root, template_path)

                        print(f"Template path: {template_path}")

                        # Read actual template content
                        if not os.path.exists(template_path):
                            failed_templates.append(yaml_path)
                            errors[yaml_path] = (
                                f"Template file not found: {template_path}"
                            )
                            print(f"ERROR: Template file not found: {template_path}")
                            continue

                        print(f"Reading template content from: {template_path}")
                        with open(template_path, "r", encoding="utf-8") as f:
                            template_content = f.read()

                        print(
                            f"Template content length: {len(template_content)} characters"
                        )

                        # Prepare template data
                        template_name = properties.get(
                            "name", os.path.splitext(os.path.basename(template_path))[0]
                        )
                        template_data = {
                            "name": template_name,
                            "source": properties.get("source", "file"),
                            "template_type": properties.get("type", "jinja2"),
                            "category": properties.get(
                                "category",
                                import_request.default_category or "uncategorized",
                            ),
                            "content": template_content,
                            "description": properties.get("description", ""),
                            "filename": os.path.basename(template_path),
                            "created_by": current_user.get("username"),
                            "scope": "global",  # Imported templates are global by default
                        }

                        print(
                            f"Template data prepared: {template_data['name']}, type: {template_data['template_type']}, category: {template_data['category']}, content_length: {len(template_data['content'])}"
                        )

                        # Check for existing template
                        if not import_request.overwrite_existing:
                            existing = template_manager.get_template_by_name(
                                template_data["name"]
                            )
                            if existing:
                                skipped_templates.append(template_data["name"])
                                print(
                                    f"SKIPPED: Template {template_data['name']} already exists"
                                )
                                continue

                        # Create template
                        print(f"Creating template: {template_data['name']}")
                        template_id = template_manager.create_template(template_data)
                        print(f"Template creation result: {template_id}")
                        if template_id:
                            imported_templates.append(template_data["name"])
                            print(
                                f"SUCCESS: Imported template: {template_data['name']}"
                            )
                        else:
                            failed_templates.append(template_data["name"])
                            errors[template_data["name"]] = "Failed to create template"
                            print(
                                f"FAILED: Could not create template: {template_data['name']}"
                            )

                    except Exception as e:
                        failed_templates.append(yaml_path)
                        errors[yaml_path] = str(e)
                        print(f"Error processing {yaml_path}: {e}")

            message = f"Imported {len(imported_templates)} templates from YAML files"
        elif import_request.source_type == "file_bulk":
            # Import from uploaded files
            # Accept .textfsm, .j2, .txt, etc.
            if import_request.file_contents:
                for file_data in import_request.file_contents:
                    try:
                        # Only allow certain extensions
                        ext = os.path.splitext(file_data["filename"])[1].lower()
                        if ext not in [".txt", ".j2", ".textfsm"]:
                            skipped_templates.append(file_data["filename"])
                            continue
                        # Use original filename for name and infer type/category
                        inferred_type = import_request.default_template_type
                        inferred_category = import_request.default_category
                        if ext == ".textfsm":
                            inferred_type = "textfsm"
                            if not inferred_category:
                                inferred_category = "parser"
                        template_data = {
                            "name": os.path.splitext(file_data["filename"])[0],
                            "source": "file",
                            "template_type": inferred_type,
                            "category": inferred_category,
                            "content": file_data["content"],
                            "filename": file_data["filename"],
                            "created_by": current_user.get("username"),
                            "scope": "global",  # Imported templates are global by default
                        }
                        if not import_request.overwrite_existing:
                            existing = template_manager.get_template_by_name(
                                template_data["name"]
                            )
                            if existing:
                                skipped_templates.append(template_data["name"])
                                continue
                        template_id = template_manager.create_template(template_data)
                        if template_id:
                            imported_templates.append(template_data["name"])
                        else:
                            failed_templates.append(template_data["name"])
                    except Exception as e:
                        failed_templates.append(file_data["filename"])
                        errors[file_data["filename"]] = str(e)
            message = (
                f"Imported {len(imported_templates)} templates from uploaded files"
            )
        else:
            raise ValueError(
                f"Unsupported import source type: {import_request.source_type}"
            )

        return TemplateImportResponse(
            imported_templates=imported_templates,
            skipped_templates=skipped_templates,
            failed_templates=failed_templates,
            errors=errors,
            total_processed=len(imported_templates)
            + len(skipped_templates)
            + len(failed_templates),
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
    """
    Advanced unified template rendering for both netmiko and agent templates.

    This endpoint:
    - Handles both netmiko and agent template types
    - Executes pre_run commands dynamically for netmiko templates
    - Fetches inventory context for agent templates
    - Supports all necessary variables and context

    The frontend should send user_variables WITHOUT pre_run.raw and pre_run.parsed,
    as the backend will execute and parse commands dynamically.
    """
    try:
        from jinja2 import Template, TemplateError, UndefinedError
        import re

        category = render_request.category.lower()
        template_content = render_request.template_content
        warnings = []

        # Initialize pre_run variables (only used for netmiko templates)
        pre_run_output = None
        pre_run_parsed = None

        # Initialize context with user variables
        context = {}
        if render_request.user_variables:
            context.update(render_request.user_variables)

        # Handle netmiko templates
        if category == "netmiko":
            # Initialize pre_run to empty (optional, will be populated if command provided)
            context["pre_run"] = {"raw": "", "parsed": []}

            # Execute pre-run command if provided
            if (
                render_request.pre_run_command
                and render_request.pre_run_command.strip()
            ):
                if not render_request.device_id:
                    raise ValueError(
                        "A test device is required to execute pre-run commands. "
                        "Please select a test device in the Netmiko Options panel."
                    )
                if not render_request.credential_id:
                    raise ValueError(
                        "Device credentials are required to execute pre-run commands. "
                        "Please select credentials in the Netmiko Options panel."
                    )

                try:
                    # Import the render service to use its pre-run execution method
                    from services.network.automation.render import render_service

                    pre_run_result = await render_service._execute_pre_run_command(
                        device_id=render_request.device_id,
                        command=render_request.pre_run_command.strip(),
                        credential_id=render_request.credential_id,
                    )

                    pre_run_output = pre_run_result.get("raw_output", "")
                    pre_run_parsed = pre_run_result.get("parsed_output", [])

                    # Add to context as pre_run object
                    context["pre_run"] = {
                        "raw": pre_run_output,
                        "parsed": pre_run_parsed,
                    }

                    if pre_run_result.get("parse_error"):
                        warnings.append(
                            f"TextFSM parsing not available: {pre_run_result['parse_error']}"
                        )

                    logger.info(
                        "Pre-run command executed. Raw length: %s, Parsed records: %s", len(pre_run_output), len(pre_run_parsed)
                    )
                except Exception as e:
                    error_msg = f"Failed to execute pre-run command: {str(e)}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)

        # Handle agent templates
        elif category == "agent":
            # Load SNMP mapping if requested
            if render_request.pass_snmp_mapping:
                logger.warning("SNMP mapping loading skipped: services.checkmk has been removed")
                context["snmp_mapping"] = {}

            # Add path if provided
            if render_request.path:
                context["path"] = render_request.path

        # Extract variables used in template
        def extract_template_variables(template_content: str) -> List[str]:
            """Extract variable names from Jinja2 template."""
            pattern = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)"
            matches = re.findall(pattern, template_content)
            return sorted(set(matches))

        variables_used = extract_template_variables(template_content)

        # Render the template
        try:
            jinja_template = Template(template_content)
            rendered_content = jinja_template.render(**context)
        except UndefinedError as e:
            available_vars = list(context.keys())
            raise ValueError(
                f"Undefined variable in template: {str(e)}. Available variables: {', '.join(available_vars)}"
            )
        except TemplateError as e:
            raise ValueError(f"Template syntax error: {str(e)}")

        return AdvancedTemplateRenderResponse(
            rendered_content=rendered_content,
            variables_used=variables_used,
            context_data=context,
            warnings=warnings,
            pre_run_output=pre_run_output,
            pre_run_parsed=pre_run_parsed,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
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
        from template_manager import template_manager

        return template_manager.health_check()

    except Exception as e:
        logger.error("Template health check failed: %s", e)
        return {"status": "unhealthy", "error": str(e)}
