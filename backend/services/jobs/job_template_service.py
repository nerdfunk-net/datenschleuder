"""Job template service.

Manages job templates for NiFi automation tasks.
"""

from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional
from repositories.jobs.job_template_repository import JobTemplateRepository

logger = logging.getLogger(__name__)


class JobTemplateService:
    def __init__(self):
        self.repo = JobTemplateRepository()

    def create_job_template(
        self,
        name: str,
        job_type: str,
        user_id: int,
        created_by: str,
        description: Optional[str] = None,
        nifi_cluster_ids: Optional[List[int]] = None,
        is_global: bool = False,
        check_queues_mode: Optional[str] = None,
        check_queues_count_yellow: Optional[int] = None,
        check_queues_count_red: Optional[int] = None,
        check_queues_bytes_yellow: Optional[int] = None,
        check_queues_bytes_red: Optional[int] = None,
        check_progress_group_nifi_cluster_id: Optional[int] = None,
        check_progress_group_process_group_id: Optional[str] = None,
        check_progress_group_process_group_path: Optional[str] = None,
        check_progress_group_check_children: bool = True,
        check_progress_group_expected_status: str = "Running",
    ) -> Dict[str, Any]:
        if self.repo.check_name_exists(name, user_id if not is_global else None):
            raise ValueError(f"A job template with name '{name}' already exists")
        nifi_cluster_ids_json = json.dumps(nifi_cluster_ids) if nifi_cluster_ids is not None else None
        template = self.repo.create(
            name=name,
            job_type=job_type,
            description=description,
            nifi_cluster_ids=nifi_cluster_ids_json,
            is_global=is_global,
            user_id=user_id if not is_global else None,
            created_by=created_by,
            check_queues_mode=check_queues_mode,
            check_queues_count_yellow=check_queues_count_yellow,
            check_queues_count_red=check_queues_count_red,
            check_queues_bytes_yellow=check_queues_bytes_yellow,
            check_queues_bytes_red=check_queues_bytes_red,
            check_progress_group_nifi_cluster_id=check_progress_group_nifi_cluster_id,
            check_progress_group_process_group_id=check_progress_group_process_group_id,
            check_progress_group_process_group_path=check_progress_group_process_group_path,
            check_progress_group_check_children=check_progress_group_check_children,
            check_progress_group_expected_status=check_progress_group_expected_status,
        )
        logger.info("Created job template: %s (ID: %s)", name, template.id)
        return self._model_to_dict(template)

    def get_job_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        template = self.repo.get_by_id(template_id)
        return self._model_to_dict(template) if template else None

    def get_job_template_by_name(self, name: str, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        template = self.repo.get_by_name(name, user_id)
        return self._model_to_dict(template) if template else None

    def list_job_templates(self, user_id: Optional[int] = None, job_type: Optional[str] = None) -> List[Dict[str, Any]]:
        if user_id is not None:
            templates = self.repo.get_user_templates(user_id, job_type)
        else:
            templates = self.repo.get_global_templates(job_type)
        return [self._model_to_dict(t) for t in templates]

    def get_user_job_templates(self, user_id: int, job_type: Optional[str] = None) -> List[Dict[str, Any]]:
        templates = self.repo.get_user_templates(user_id, job_type)
        return [self._model_to_dict(t) for t in templates]

    def update_job_template(
        self,
        template_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        nifi_cluster_ids: Optional[List[int]] = None,
        check_queues_mode: Optional[str] = None,
        check_queues_count_yellow: Optional[int] = None,
        check_queues_count_red: Optional[int] = None,
        check_queues_bytes_yellow: Optional[int] = None,
        check_queues_bytes_red: Optional[int] = None,
        is_global: Optional[bool] = None,
        user_id: Optional[int] = None,
        check_progress_group_nifi_cluster_id: Optional[int] = None,
        check_progress_group_process_group_id: Optional[str] = None,
        check_progress_group_process_group_path: Optional[str] = None,
        check_progress_group_check_children: Optional[bool] = None,
        check_progress_group_expected_status: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if name is not None:
            if self.repo.check_name_exists(name, user_id, exclude_id=template_id):
                raise ValueError(f"A job template with name '{name}' already exists")
        update_data = {}
        if name is not None:
            update_data["name"] = name
        if description is not None:
            update_data["description"] = description
        if nifi_cluster_ids is not None:
            update_data["nifi_cluster_ids"] = json.dumps(nifi_cluster_ids)
        if check_queues_mode is not None:
            update_data["check_queues_mode"] = check_queues_mode
        if check_queues_count_yellow is not None:
            update_data["check_queues_count_yellow"] = check_queues_count_yellow
        if check_queues_count_red is not None:
            update_data["check_queues_count_red"] = check_queues_count_red
        if check_queues_bytes_yellow is not None:
            update_data["check_queues_bytes_yellow"] = check_queues_bytes_yellow
        if check_queues_bytes_red is not None:
            update_data["check_queues_bytes_red"] = check_queues_bytes_red
        if check_progress_group_nifi_cluster_id is not None:
            update_data["check_progress_group_nifi_cluster_id"] = check_progress_group_nifi_cluster_id
        if check_progress_group_process_group_id is not None:
            update_data["check_progress_group_process_group_id"] = check_progress_group_process_group_id
        if check_progress_group_process_group_path is not None:
            update_data["check_progress_group_process_group_path"] = check_progress_group_process_group_path
        if check_progress_group_check_children is not None:
            update_data["check_progress_group_check_children"] = check_progress_group_check_children
        if check_progress_group_expected_status is not None:
            update_data["check_progress_group_expected_status"] = check_progress_group_expected_status
        if is_global is not None:
            update_data["is_global"] = is_global
            if is_global:
                update_data["user_id"] = None
            elif user_id is not None:
                update_data["user_id"] = user_id
        if not update_data:
            return self.get_job_template(template_id)
        template = self.repo.update(template_id, **update_data)
        if template:
            logger.info("Updated job template: %s (ID: %s)", template.name, template_id)
            return self._model_to_dict(template)
        return None

    def delete_job_template(self, template_id: int) -> bool:
        template = self.repo.get_by_id(template_id)
        if template:
            self.repo.delete(template_id)
            logger.info("Deleted job template: %s (ID: %s)", template.name, template_id)
            return True
        return False

    def get_job_types(self) -> List[Dict[str, str]]:
        return [
            {
                "value": "check_queues",
                "label": "Check Queues",
                "description": "Monitor NiFi connection queue depths and alert on thresholds",
            },
            {
                "value": "check_progress_group",
                "label": "Check ProcessGroup",
                "description": "Check the operational status of a NiFi process group",
            },
        ]

    def _model_to_dict(self, template) -> Dict[str, Any]:
        return {
            "id": template.id,
            "name": template.name,
            "job_type": template.job_type,
            "description": template.description,
            "nifi_cluster_ids": json.loads(template.nifi_cluster_ids) if template.nifi_cluster_ids else None,
            "check_queues_mode": template.check_queues_mode,
            "check_queues_count_yellow": template.check_queues_count_yellow,
            "check_queues_count_red": template.check_queues_count_red,
            "check_queues_bytes_yellow": template.check_queues_bytes_yellow,
            "check_queues_bytes_red": template.check_queues_bytes_red,
            "check_progress_group_nifi_cluster_id": template.check_progress_group_nifi_cluster_id,
            "check_progress_group_process_group_id": template.check_progress_group_process_group_id,
            "check_progress_group_process_group_path": template.check_progress_group_process_group_path,
            "check_progress_group_check_children": template.check_progress_group_check_children,
            "check_progress_group_expected_status": template.check_progress_group_expected_status,
            "is_global": template.is_global,
            "user_id": template.user_id,
            "created_by": template.created_by,
            "created_at": template.created_at,
            "updated_at": template.updated_at,
        }
