"""
Job Templates Router
API endpoints for managing job templates
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from core.auth import verify_token
from services.auth.rbac_service import RBACService as _RBACService
from services.jobs.job_template_service import JobTemplateService as _JobTemplateService
rbac_manager = _RBACService()
job_template_manager = _JobTemplateService()
from models.jobs import (
    JobTemplateCreate,
    JobTemplateUpdate,
    JobTemplateResponse,
    JobTemplateListResponse,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/job-templates", tags=["job-templates"])


@router.post(
    "", response_model=JobTemplateResponse, status_code=status.HTTP_201_CREATED
)
def create_job_template(
    template_data: JobTemplateCreate, current_user: dict = Depends(verify_token)
):
    """
    Create a new job template

    - Global templates require 'jobs.templates:write' permission
    - Private templates can be created by any authenticated user
    """
    try:
        # Check permissions for global templates
        if template_data.is_global:
            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs.templates", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs.templates:write required for global templates",
                )

        # Create the template
        template = job_template_manager.create_job_template(
            name=template_data.name,
            job_type=template_data.job_type,
            user_id=current_user["user_id"],
            created_by=current_user["username"],
            description=template_data.description,
            nifi_cluster_ids=template_data.nifi_cluster_ids,
            is_global=template_data.is_global,
            check_queues_mode=template_data.check_queues_mode,
            check_queues_count_yellow=template_data.check_queues_count_yellow,
            check_queues_count_red=template_data.check_queues_count_red,
            check_queues_bytes_yellow=template_data.check_queues_bytes_yellow,
            check_queues_bytes_red=template_data.check_queues_bytes_red,
            check_progress_group_nifi_cluster_id=template_data.check_progress_group_nifi_cluster_id,
            check_progress_group_process_group_id=template_data.check_progress_group_process_group_id,
            check_progress_group_process_group_path=template_data.check_progress_group_process_group_path,
            check_progress_group_check_children=template_data.check_progress_group_check_children
            if template_data.check_progress_group_check_children is not None
            else True,
            check_progress_group_expected_status=template_data.check_progress_group_expected_status
            or "Running",
            export_flows_nifi_cluster_ids=template_data.export_flows_nifi_cluster_ids,
            export_flows_all_flows=template_data.export_flows_all_flows,
            export_flows_filters=template_data.export_flows_filters,
            export_flows_git_repo_id=template_data.export_flows_git_repo_id,
            export_flows_filename=template_data.export_flows_filename,
            export_flows_export_type=template_data.export_flows_export_type or "json",
        )

        return JobTemplateResponse(**template)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Error creating job template: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job template: {str(e)}",
        )


@router.get("", response_model=JobTemplateListResponse)
def list_job_templates(
    job_type: Optional[str] = None, current_user: dict = Depends(verify_token)
):
    """
    List all job templates accessible to the current user

    Returns:
    - Global templates (visible to all)
    - User's private templates
    """
    try:
        templates = job_template_manager.get_user_job_templates(
            current_user["user_id"], job_type
        )

        return JobTemplateListResponse(
            templates=[JobTemplateResponse(**t) for t in templates],
            total=len(templates),
        )

    except Exception as e:
        logger.error("Error listing job templates: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list job templates: {str(e)}",
        )


@router.get("/types")
def get_job_types(current_user: dict = Depends(verify_token)):
    """Get available job types"""
    return job_template_manager.get_job_types()


@router.get("/{template_id}", response_model=JobTemplateResponse)
def get_job_template(
    template_id: int, current_user: dict = Depends(verify_token)
):
    """Get a specific job template by ID"""
    try:
        template = job_template_manager.get_job_template(template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        # Check access - user must own private template or it must be global
        if (
            not template.get("is_global")
            and template.get("user_id") != current_user["user_id"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own private templates",
            )

        return JobTemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting job template: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job template: {str(e)}",
        )


@router.put("/{template_id}", response_model=JobTemplateResponse)
def update_job_template(
    template_id: int,
    update_data: JobTemplateUpdate,
    current_user: dict = Depends(verify_token),
):
    """Update a job template"""
    try:
        template = job_template_manager.get_job_template(template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        # Check permissions
        is_admin = current_user.get("role") == "admin"
        has_write = rbac_manager.has_permission(
            current_user["user_id"], "jobs.templates", "write"
        )
        is_owner = template.get("user_id") == current_user["user_id"]

        if not (is_admin or has_write or is_owner):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: jobs.templates:write required to edit this template",
            )

        # Update the template
        updated_template = job_template_manager.update_job_template(
            template_id=template_id,
            name=update_data.name,
            description=update_data.description,
            nifi_cluster_ids=update_data.nifi_cluster_ids,
            check_queues_mode=update_data.check_queues_mode,
            check_queues_count_yellow=update_data.check_queues_count_yellow,
            check_queues_count_red=update_data.check_queues_count_red,
            check_queues_bytes_yellow=update_data.check_queues_bytes_yellow,
            check_queues_bytes_red=update_data.check_queues_bytes_red,
            check_progress_group_nifi_cluster_id=update_data.check_progress_group_nifi_cluster_id,
            check_progress_group_process_group_id=update_data.check_progress_group_process_group_id,
            check_progress_group_process_group_path=update_data.check_progress_group_process_group_path,
            check_progress_group_check_children=update_data.check_progress_group_check_children,
            check_progress_group_expected_status=update_data.check_progress_group_expected_status,
            export_flows_nifi_cluster_ids=update_data.export_flows_nifi_cluster_ids,
            export_flows_all_flows=update_data.export_flows_all_flows,
            export_flows_filters=update_data.export_flows_filters,
            export_flows_git_repo_id=update_data.export_flows_git_repo_id,
            export_flows_filename=update_data.export_flows_filename,
            export_flows_export_type=update_data.export_flows_export_type,
            is_global=update_data.is_global,
            user_id=current_user["user_id"],
        )

        if not updated_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        return JobTemplateResponse(**updated_template)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating job template: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update job template: {str(e)}",
        )


@router.delete("/{template_id}")
def delete_job_template(
    template_id: int, current_user: dict = Depends(verify_token)
):
    """Delete a job template"""
    try:
        template = job_template_manager.get_job_template(template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        # Check permissions
        is_admin = current_user.get("role") == "admin"
        has_delete = rbac_manager.has_permission(
            current_user["user_id"], "jobs.templates", "delete"
        )
        is_owner = template.get("user_id") == current_user["user_id"]

        if not (is_admin or has_delete or is_owner):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: jobs.templates:delete required to delete this template",
            )

        deleted = job_template_manager.delete_job_template(template_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        return {"message": "Job template deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting job template: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job template: {str(e)}",
        )
