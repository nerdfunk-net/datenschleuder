"""Template management service.

Handles template storage, retrieval, and management.
All templates are stored in PostgreSQL database.
"""

from __future__ import annotations
import logging
import json
import hashlib
from typing import Any, Dict, List, Optional
from repositories.settings.template_repository import (
    TemplateRepository,
    TemplateVersionRepository,
)
from core.models import Template, TemplateVersion

logger = logging.getLogger(__name__)


class TemplateService:
    def __init__(self):
        pass

    def create_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()
            if not template_data.get("name"):
                raise ValueError("Template name is required")
            if not template_data.get("source"):
                raise ValueError("Template source is required")
            existing = repo.get_by_name(template_data["name"], active_only=True)
            if existing:
                raise ValueError(
                    f"Template with name '{template_data['name']}' already exists"
                )
            variables_json = json.dumps(template_data.get("variables", {}))
            tags_json = json.dumps(template_data.get("tags", []))
            content = template_data.get("content", "")
            content_hash = (
                hashlib.sha256(content.encode()).hexdigest() if content else None
            )
            template = repo.create(
                name=template_data["name"],
                source=template_data["source"],
                template_type=template_data.get("template_type", "jinja2"),
                category=template_data.get("category"),
                description=template_data.get("description"),
                content=content,
                filename=template_data.get("filename"),
                content_hash=content_hash,
                variables=variables_json,
                tags=tags_json,
                pass_snmp_mapping=template_data.get("pass_snmp_mapping", False),
                inventory_id=template_data.get("inventory_id"),
                pre_run_command=template_data.get("pre_run_command"),
                credential_id=template_data.get("credential_id"),
                execution_mode=template_data.get("execution_mode", "run_on_device"),
                file_path=template_data.get("file_path"),
                created_by=template_data.get("created_by"),
                scope=template_data.get("scope", "global"),
                is_active=True,
            )
            template_id = template.id
            if content:
                self._create_template_version_obj(
                    version_repo, template_id, content, content_hash, "Initial version"
                )
            logger.info(
                "Template '%s' created with ID %s", template_data["name"], template_id
            )
            return template_id
        except ValueError:
            raise
        except Exception as e:
            logger.error("Error creating template: %s", e)
            raise

    def get_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            template = repo.get_by_id(template_id)
            if template:
                result = self._model_to_dict(template)
                logger.info(
                    "DEBUG: get_template(%s) - scope=%s, created_by=%s",
                    template_id,
                    result.get("scope"),
                    result.get("created_by"),
                )
                return result
            return None
        except Exception as e:
            logger.error("Error getting template %s: %s", template_id, e)
            return None

    def get_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            template = repo.get_by_name(name, active_only=True)
            return self._model_to_dict(template) if template else None
        except Exception as e:
            logger.error("Error getting template by name '%s': %s", name, e)
            return None

    def list_templates(
        self,
        category: str = None,
        source: str = None,
        active_only: bool = True,
        username: str = None,
    ) -> List[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            logger.info("DEBUG: list_templates - filtering for username=%s", username)
            templates = repo.list_templates(
                category=category,
                source=source,
                active_only=active_only,
                username=username,
            )
            results = [self._model_to_dict(t) for t in templates]
            logger.info("DEBUG: list_templates - found %s templates", len(results))
            return results
        except Exception as e:
            logger.error("Error listing templates: %s", e)
            return []

    def update_template(self, template_id: int, template_data: Dict[str, Any]) -> bool:
        try:
            repo = TemplateRepository()
            version_repo = TemplateVersionRepository()
            current_obj = repo.get_by_id(template_id)
            if not current_obj:
                raise ValueError(f"Template with ID {template_id} not found")
            current = self._model_to_dict(current_obj)
            variables_json = json.dumps(template_data.get("variables", {}))
            tags_json = json.dumps(template_data.get("tags", []))
            content = template_data.get("content", current.get("content", ""))
            content_hash = (
                hashlib.sha256(content.encode()).hexdigest() if content else None
            )
            content_changed = content_hash != current.get("content_hash")
            new_scope = template_data.get("scope", current.get("scope", "global"))
            update_kwargs = {
                "name": template_data.get("name", current["name"]),
                "template_type": template_data.get(
                    "template_type", current["template_type"]
                ),
                "category": template_data.get("category", current["category"]),
                "description": template_data.get("description", current["description"]),
                "content": content,
                "filename": template_data.get("filename", current["filename"]),
                "content_hash": content_hash,
                "variables": variables_json,
                "tags": tags_json,
                "pass_snmp_mapping": template_data.get(
                    "pass_snmp_mapping", current.get("pass_snmp_mapping", False)
                ),
                "inventory_id": template_data.get(
                    "inventory_id", current.get("inventory_id")
                ),
                "pre_run_command": template_data.get(
                    "pre_run_command", current.get("pre_run_command")
                ),
                "credential_id": template_data.get(
                    "credential_id", current.get("credential_id")
                ),
                "execution_mode": template_data.get(
                    "execution_mode", current.get("execution_mode", "run_on_device")
                ),
                "file_path": template_data.get("file_path", current.get("file_path")),
                "scope": new_scope,
            }
            repo.update(template_id, **update_kwargs)
            if content_changed and content:
                self._create_template_version_obj(
                    version_repo,
                    template_id,
                    content,
                    content_hash,
                    template_data.get("change_notes", "Template updated"),
                )
            logger.info("Template %s updated", template_id)
            return True
        except Exception as e:
            logger.error("Error updating template %s: %s", template_id, e)
            return False

    def delete_template(self, template_id: int, hard_delete: bool = False) -> bool:
        try:
            repo = TemplateRepository()
            if hard_delete:
                repo.delete(template_id)
            else:
                repo.update(template_id, is_active=False)
            logger.info(
                "Template %s %s",
                template_id,
                "deleted" if hard_delete else "deactivated",
            )
            return True
        except Exception as e:
            logger.error("Error deleting template %s: %s", template_id, e)
            return False

    def get_template_content(self, template_id: int) -> Optional[str]:
        try:
            template = self.get_template(template_id)
            return template.get("content") if template else None
        except Exception as e:
            logger.error("Error getting template content for %s: %s", template_id, e)
            return None

    def render_template(
        self, template_name: str, category: str, data: Dict[str, Any]
    ) -> str:
        try:
            from jinja2 import Environment, BaseLoader

            template = self.get_template_by_name(template_name)
            if not template:
                templates = self.list_templates(category=category if category else None)
                matching = [t for t in templates if t["name"] == template_name]
                if matching:
                    template = matching[0]
                else:
                    raise ValueError(
                        f"Template '{template_name}' not found in category '{category}'"
                    )
            content = self.get_template_content(template["id"])
            if not content:
                raise ValueError(f"Template content not found for '{template_name}'")
            env = Environment(loader=BaseLoader())
            jinja_template = env.from_string(content)
            rendered = jinja_template.render(**data)
            logger.info(
                "Successfully rendered template '%s' from category '%s'",
                template_name,
                category,
            )
            return rendered
        except Exception as e:
            logger.error(
                "Error rendering template '%s' in category '%s': %s",
                template_name,
                category,
                e,
            )
            raise

    def get_template_versions(self, template_id: int) -> List[Dict[str, Any]]:
        try:
            version_repo = TemplateVersionRepository()
            versions = version_repo.get_versions_by_template_id(template_id)
            return [self._version_model_to_dict(v) for v in versions]
        except Exception as e:
            logger.error("Error getting template versions for %s: %s", template_id, e)
            return []

    def search_templates(
        self, query: str, search_content: bool = False, username: str = None
    ) -> List[Dict[str, Any]]:
        try:
            repo = TemplateRepository()
            templates = repo.search_templates(
                query_text=query, search_content=search_content, username=username
            )
            return [self._model_to_dict(t) for t in templates]
        except Exception as e:
            logger.error("Error searching templates: %s", e)
            return []

    def get_categories(self) -> List[str]:
        try:
            return TemplateRepository().get_categories()
        except Exception as e:
            logger.error("Error getting categories: %s", e)
            return []

    def health_check(self) -> Dict[str, Any]:
        try:
            repo = TemplateRepository()
            return {
                "status": "healthy",
                "storage_type": "database",
                "active_templates": repo.get_active_count(),
                "total_templates": repo.get_total_count(),
                "categories": repo.get_categories_count(),
            }
        except Exception as e:
            logger.error("Template database health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e)}

    def _model_to_dict(self, template: Template) -> Dict[str, Any]:
        result = {
            "id": template.id,
            "name": template.name,
            "source": template.source,
            "template_type": template.template_type,
            "category": template.category,
            "description": template.description,
            "content": template.content,
            "filename": template.filename,
            "content_hash": template.content_hash,
            "created_by": template.created_by,
            "scope": template.scope,
            "is_active": bool(template.is_active),
            "pass_snmp_mapping": bool(template.pass_snmp_mapping),
            "inventory_id": template.inventory_id,
            "pre_run_command": template.pre_run_command,
            "credential_id": template.credential_id,
            "execution_mode": template.execution_mode,
            "file_path": template.file_path,
            "last_sync": template.last_sync.isoformat() if template.last_sync else None,
            "sync_status": template.sync_status,
            "created_at": template.created_at.isoformat()
            if template.created_at
            else None,
            "updated_at": template.updated_at.isoformat()
            if template.updated_at
            else None,
        }
        result["variables"] = (
            json.loads(template.variables) if template.variables else {}
        )
        result["tags"] = json.loads(template.tags) if template.tags else []
        return result

    def _version_model_to_dict(self, version: TemplateVersion) -> Dict[str, Any]:
        return {
            "id": version.id,
            "template_id": version.template_id,
            "version_number": version.version_number,
            "content": version.content,
            "content_hash": version.content_hash,
            "created_at": version.created_at.isoformat()
            if version.created_at
            else None,
            "created_by": version.created_by,
            "change_notes": version.change_notes,
        }

    def _create_template_version_obj(
        self, version_repo, template_id, content, content_hash, notes=""
    ):
        try:
            version_number = version_repo.get_max_version_number(template_id) + 1
            version_repo.create(
                template_id=template_id,
                version_number=version_number,
                content=content,
                content_hash=content_hash,
                change_notes=notes,
            )
        except Exception as e:
            logger.error("Error creating template version: %s", e)


# Module-level singleton
template_service = TemplateService()
