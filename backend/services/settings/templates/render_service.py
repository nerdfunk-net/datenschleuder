"""Template Render Service.

Handles advanced unified template rendering for both netmiko and agent templates.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class TemplateRenderService:
    """Service for rendering templates with optional pre-run command execution."""

    async def render_template(
        self,
        template_content: str,
        category: str,
        user_variables: Optional[Dict[str, Any]] = None,
        pre_run_command: Optional[str] = None,
        device_id: Optional[int] = None,
        credential_id: Optional[int] = None,
        pass_snmp_mapping: bool = False,
        path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Render a template with the given context.

        Args:
            template_content: Raw Jinja2 template string.
            category: Template category (e.g. "netmiko", "agent").
            user_variables: Additional variables to inject into the context.
            pre_run_command: CLI command to execute before rendering (netmiko only).
            device_id: Device to run pre_run_command against (netmiko only).
            credential_id: Credentials to use for pre_run_command (netmiko only).
            pass_snmp_mapping: Inject SNMP mapping into context (agent only).
            path: Optional path variable to inject into context (agent only).

        Returns:
            Dict with rendered_content, variables_used, context_data, warnings,
            pre_run_output, pre_run_parsed.

        Raises:
            ValueError: On validation errors or template rendering errors.
        """
        category = category.lower()
        context: Dict[str, Any] = {}
        if user_variables:
            context.update(user_variables)

        warnings: List[str] = []
        pre_run_output: Optional[str] = None
        pre_run_parsed: Optional[list] = None

        if category == "netmiko":
            context["pre_run"] = {"raw": "", "parsed": []}
            if pre_run_command and pre_run_command.strip():
                pre_run_output, pre_run_parsed, pre_run_warnings = await self._execute_pre_run(
                    pre_run_command.strip(), device_id, credential_id
                )
                context["pre_run"] = {"raw": pre_run_output, "parsed": pre_run_parsed}
                warnings.extend(pre_run_warnings)

        elif category == "agent":
            if pass_snmp_mapping:
                context["snmp_mapping"] = {}
            if path:
                context["path"] = path

        variables_used = self._extract_template_variables(template_content)
        rendered_content = self._render_jinja2(template_content, context)

        return {
            "rendered_content": rendered_content,
            "variables_used": variables_used,
            "context_data": context,
            "warnings": warnings,
            "pre_run_output": pre_run_output,
            "pre_run_parsed": pre_run_parsed,
        }

    async def _execute_pre_run(
        self,
        command: str,
        device_id: Optional[int],
        credential_id: Optional[int],
    ) -> tuple:
        """Execute a pre-run command and return (raw_output, parsed_output, warnings)."""
        if not device_id:
            raise ValueError(
                "A test device is required to execute pre-run commands. "
                "Please select a test device in the Netmiko Options panel."
            )
        if not credential_id:
            raise ValueError(
                "Device credentials are required to execute pre-run commands. "
                "Please select credentials in the Netmiko Options panel."
            )

        from services.network.automation.render import render_service

        result = await render_service._execute_pre_run_command(
            device_id=device_id,
            command=command,
            credential_id=credential_id,
        )

        raw_output = result.get("raw_output", "")
        parsed_output = result.get("parsed_output", [])
        warnings = []
        if result.get("parse_error"):
            warnings.append(f"TextFSM parsing not available: {result['parse_error']}")

        logger.info(
            "Pre-run command executed. Raw length: %s, Parsed records: %s",
            len(raw_output),
            len(parsed_output),
        )
        return raw_output, parsed_output, warnings

    def _extract_template_variables(self, template_content: str) -> List[str]:
        """Extract variable names used in a Jinja2 template."""
        pattern = r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_\.]*)"
        matches = re.findall(pattern, template_content)
        return sorted(set(matches))

    def _render_jinja2(self, template_content: str, context: Dict[str, Any]) -> str:
        """Render a Jinja2 template with the given context.

        Raises:
            ValueError: On undefined variable or syntax errors.
        """
        from jinja2 import Template, TemplateError, UndefinedError

        try:
            jinja_template = Template(template_content)
            return jinja_template.render(**context)
        except UndefinedError as e:
            available_vars = list(context.keys())
            raise ValueError(
                f"Undefined variable in template: {str(e)}. "
                f"Available variables: {', '.join(available_vars)}"
            )
        except TemplateError as e:
            raise ValueError(f"Template syntax error: {str(e)}")
