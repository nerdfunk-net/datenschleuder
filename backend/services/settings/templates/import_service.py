"""Template Import Service.

Handles scanning, parsing, and importing templates from YAML, file, and Git sources.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import yaml

from services.settings.templates.type_inference import infer_from_extension

logger = logging.getLogger(__name__)


def _find_backend_root() -> Path:
    """Locate the backend root directory regardless of where this file lives."""
    p = Path(__file__).resolve().parent
    while p.name != "backend" and p != p.parent:
        p = p.parent
    return p


class TemplateImportService:
    """Service for importing templates from various sources."""

    def __init__(self, template_manager=None):
        if template_manager is None:
            from services.settings.template_service import template_service

            template_manager = template_service
        self.template_manager = template_manager

    def scan_import_directory(self, import_dir: Optional[Path] = None):
        """Scan the import directory for importable YAML template files.

        Args:
            import_dir: Directory to scan. Defaults to ``<backend-root>/../contributing-data``.

        Returns:
            TemplateScanImportResponse-compatible dict.
        """
        from models.templates import ImportableTemplateInfo, TemplateScanImportResponse

        if import_dir is None:
            import_dir = _find_backend_root().parent / "contributing-data"

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

                if not isinstance(data, dict):
                    continue

                if "properties" in data and isinstance(data["properties"], dict):
                    props = data["properties"]
                    template_info = ImportableTemplateInfo(
                        name=props.get("name", yaml_file.stem),
                        description=props.get(
                            "description", "No description available"
                        ),
                        category=props.get("category", "default"),
                        source=props.get("source", "file"),
                        file_path=str(yaml_file.absolute()),
                        template_type=props.get(
                            "type", props.get("template_type", "jinja2")
                        ),
                    )
                else:
                    template_info = ImportableTemplateInfo(
                        name=data.get("name", yaml_file.stem),
                        description=data.get("description", "No description available"),
                        category=data.get("category", "default"),
                        source=data.get("source", "file"),
                        file_path=str(yaml_file.absolute()),
                        template_type=data.get("template_type", "jinja2"),
                    )

                templates.append(template_info)
            except Exception as e:
                logger.warning("Failed to parse %s: %s", yaml_file, e)

        return TemplateScanImportResponse(
            templates=templates,
            total_found=len(templates),
            message=f"Found {len(templates)} importable templates",
        )

    def import_from_yaml_bulk(
        self,
        yaml_file_paths: list,
        overwrite: bool,
        created_by: str,
        default_category: Optional[str] = None,
    ) -> dict:
        """Import templates from YAML descriptor files.

        Each YAML file describes a template whose content lives at ``path`` relative
        to the backend root directory.

        Returns:
            Dict with keys: imported, skipped, failed, errors.
        """
        backend_root = _find_backend_root()
        imported, skipped, failed, errors = [], [], [], {}

        for yaml_path in yaml_file_paths:
            try:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    yaml_data = yaml.safe_load(f)

                template_path_str = yaml_data.get("path", "")
                properties = yaml_data.get("properties", {})

                if not template_path_str:
                    failed.append(yaml_path)
                    errors[yaml_path] = "No template path specified in YAML"
                    continue

                template_path = (
                    Path(template_path_str)
                    if os.path.isabs(template_path_str)
                    else backend_root / template_path_str
                )

                if not template_path.exists():
                    failed.append(yaml_path)
                    errors[yaml_path] = f"Template file not found: {template_path}"
                    logger.error("Template file not found: %s", template_path)
                    continue

                template_content = template_path.read_text(encoding="utf-8")
                template_name = properties.get(
                    "name", os.path.splitext(template_path.name)[0]
                )

                template_data = {
                    "name": template_name,
                    "source": properties.get("source", "file"),
                    "template_type": properties.get("type", "jinja2"),
                    "category": properties.get(
                        "category", default_category or "uncategorized"
                    ),
                    "content": template_content,
                    "description": properties.get("description", ""),
                    "filename": template_path.name,
                    "created_by": created_by,
                    "scope": "global",
                }

                if not overwrite and self._template_exists(template_name):
                    skipped.append(template_name)
                    continue

                if self.template_manager.create_template(template_data):
                    imported.append(template_name)
                else:
                    failed.append(template_name)
                    errors[template_name] = "Failed to create template"

            except Exception as e:
                failed.append(yaml_path)
                errors[yaml_path] = str(e)
                logger.error("Error processing %s: %s", yaml_path, e)

        return {
            "imported": imported,
            "skipped": skipped,
            "failed": failed,
            "errors": errors,
        }

    def import_from_file_bulk(
        self,
        file_contents: list,
        overwrite: bool,
        created_by: str,
        default_template_type: str = "jinja2",
        default_category: Optional[str] = None,
    ) -> dict:
        """Import templates from in-memory file data.

        Args:
            file_contents: List of dicts with ``filename`` and ``content`` keys.

        Returns:
            Dict with keys: imported, skipped, failed, errors.
        """
        _ALLOWED_EXTENSIONS = {".txt", ".j2", ".textfsm"}
        imported, skipped, failed, errors = [], [], [], {}

        for file_data in file_contents:
            try:
                filename = file_data["filename"]
                ext = os.path.splitext(filename)[1].lower()

                if ext not in _ALLOWED_EXTENSIONS:
                    skipped.append(filename)
                    continue

                inferred_type, inferred_category = infer_from_extension(
                    filename, default_template_type, default_category
                )
                template_name = os.path.splitext(filename)[0]

                template_data = {
                    "name": template_name,
                    "source": "file",
                    "template_type": inferred_type,
                    "category": inferred_category,
                    "content": file_data["content"],
                    "filename": filename,
                    "created_by": created_by,
                    "scope": "global",
                }

                if not overwrite and self._template_exists(template_name):
                    skipped.append(template_name)
                    continue

                if self.template_manager.create_template(template_data):
                    imported.append(template_name)
                else:
                    failed.append(template_name)

            except Exception as e:
                failed.append(file_data.get("filename", "unknown"))
                errors[file_data.get("filename", "unknown")] = str(e)

        return {
            "imported": imported,
            "skipped": skipped,
            "failed": failed,
            "errors": errors,
        }

    def _template_exists(self, name: str) -> bool:
        """Return True if a template with the given name already exists."""
        return bool(self.template_manager.get_template_by_name(name))
