"""NiFi parameter context operations - pure nipyapi logic."""

import time
import logging
from typing import List, Dict, Any, Optional

import nipyapi
from nipyapi.nifi import FlowApi
from nipyapi.nifi.apis.parameter_contexts_api import ParameterContextsApi
from nipyapi.nifi.models import (
    ParameterContextEntity,
    ParameterContextDTO,
    ParameterEntity as NiFiParameterEntity,
    ParameterDTO,
)

logger = logging.getLogger(__name__)


def _extract_parameter_entity(param, context_id: str = None) -> Dict[str, Any]:
    """Extract parameter data from NiFi parameter entity."""
    p = param.parameter if hasattr(param, "parameter") else param
    return {
        "name": getattr(p, "name", "Unknown"),
        "description": getattr(p, "description", None),
        "sensitive": getattr(p, "sensitive", False),
        "value": getattr(p, "value", None) if not getattr(p, "sensitive", False) else None,
        "provided": getattr(p, "provided", False),
        "referenced_attributes": getattr(p, "referenced_attributes", None),
        "parameter_context_id": context_id,
    }


def _extract_context(context) -> Dict[str, Any]:
    """Extract parameter context data from NiFi context entity."""
    context_id = context.id if hasattr(context, "id") else "Unknown"

    parameters = []
    if hasattr(context, "component") and hasattr(context.component, "parameters"):
        for param in context.component.parameters:
            parameters.append(_extract_parameter_entity(param, context_id))

    bound_groups = []
    if hasattr(context, "component") and hasattr(context.component, "bound_process_groups"):
        for pg in context.component.bound_process_groups:
            if hasattr(pg, "to_dict"):
                bound_groups.append(pg.to_dict())

    inherited_contexts = []
    if hasattr(context, "component") and hasattr(context.component, "inherited_parameter_contexts"):
        for ipc in context.component.inherited_parameter_contexts:
            if hasattr(ipc, "id"):
                inherited_contexts.append(ipc.id)

    return {
        "id": context_id,
        "name": getattr(context.component, "name", "Unknown") if hasattr(context, "component") else "Unknown",
        "description": getattr(context.component, "description", None) if hasattr(context, "component") else None,
        "parameters": parameters,
        "bound_process_groups": bound_groups or None,
        "inherited_parameter_contexts": inherited_contexts or None,
        "component_revision": (
            context.revision.to_dict()
            if hasattr(context, "revision") and hasattr(context.revision, "to_dict")
            else None
        ),
        "permissions": (
            context.permissions.to_dict()
            if hasattr(context, "permissions") and hasattr(context.permissions, "to_dict")
            else None
        ),
    }


def list_parameter_contexts(
    search: Optional[str] = None, identifier_type: str = "name"
) -> List[Dict[str, Any]]:
    """List parameter contexts, optionally searching by name or ID."""
    contexts_list = []

    if search:
        context = nipyapi.parameters.get_parameter_context(
            identifier=search, identifier_type=identifier_type, greedy=True
        )
        if context:
            contexts_list.append(_extract_context(context))
    else:
        flow_api = FlowApi()
        param_contexts_entity = flow_api.get_parameter_contexts()

        if hasattr(param_contexts_entity, "parameter_contexts") and param_contexts_entity.parameter_contexts:
            for context in param_contexts_entity.parameter_contexts:
                contexts_list.append(_extract_context(context))

    return contexts_list


def get_parameter_context(context_id: str) -> Dict[str, Any]:
    """Get a specific parameter context by ID."""
    context = nipyapi.parameters.get_parameter_context(
        identifier=context_id, identifier_type="id", greedy=True
    )
    if not context:
        raise ValueError("Parameter context with id '%s' not found" % context_id)

    return _extract_context(context)


def create_parameter_context(
    name: str,
    description: Optional[str] = None,
    parameters: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Create a new parameter context."""
    param_entities = []
    for param in (parameters or []):
        param_dto = ParameterDTO(
            name=param["name"],
            description=param.get("description"),
            sensitive=param.get("sensitive", False),
            value=param.get("value"),
        )
        param_entities.append(NiFiParameterEntity(parameter=param_dto))

    param_context_dto = ParameterContextDTO(
        name=name,
        description=description,
        parameters=param_entities if param_entities else None,
    )

    param_context_entity = ParameterContextEntity(
        component=param_context_dto,
        revision={"version": 0},
    )

    param_api = ParameterContextsApi()
    result = param_api.create_parameter_context(body=param_context_entity)

    return {
        "id": result.id if hasattr(result, "id") else None,
        "name": result.component.name if hasattr(result, "component") else name,
    }


def update_parameter_context(
    context_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    parameters: Optional[List[Dict[str, Any]]] = None,
    inherited_parameter_contexts: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Update an existing parameter context."""
    param_api = ParameterContextsApi()
    existing_context = param_api.get_parameter_context(id=context_id)

    desired_param_names = set()
    if parameters is not None:
        desired_param_names = {param["name"] for param in parameters}

    existing_param_map = {}
    if existing_context.component.parameters:
        for existing_param in existing_context.component.parameters:
            param_name = existing_param.parameter.name
            existing_param_map[param_name] = existing_param

    final_parameters = []

    if parameters is not None:
        for param in parameters:
            if param["name"] in existing_param_map:
                existing_param = existing_param_map[param["name"]]
                existing_param.parameter.description = param.get("description")
                existing_param.parameter.sensitive = param.get("sensitive", False)
                if not param.get("sensitive", False):
                    existing_param.parameter.value = param.get("value")
                final_parameters.append(existing_param)
            else:
                param_dto = ParameterDTO(
                    name=param["name"],
                    description=param.get("description"),
                    sensitive=param.get("sensitive", False),
                    value=param.get("value"),
                )
                final_parameters.append(NiFiParameterEntity(parameter=param_dto))

        for param_name in existing_param_map:
            if param_name not in desired_param_names:
                delete_param_dto = ParameterDTO(name=param_name, value_removed=True)
                final_parameters.append(NiFiParameterEntity(parameter=delete_param_dto))
    else:
        final_parameters = list(existing_param_map.values())

    existing_context.component.parameters = final_parameters
    if name is not None:
        existing_context.component.name = name
    if description is not None:
        existing_context.component.description = description

    if inherited_parameter_contexts is not None:
        if len(inherited_parameter_contexts) == 0:
            existing_context.component.inherited_parameter_contexts = []
        else:
            from nipyapi.nifi.models import (
                ParameterContextReferenceEntity,
                ParameterContextReferenceDTO,
            )
            inherited_refs = []
            for ctx_id in inherited_parameter_contexts:
                try:
                    ref_context = param_api.get_parameter_context(id=ctx_id)
                    ref_dto = ParameterContextReferenceDTO(
                        id=ctx_id,
                        name=ref_context.component.name if hasattr(ref_context, "component") else None,
                    )
                    ref_entity = ParameterContextReferenceEntity(
                        id=ctx_id,
                        component=ref_dto,
                        permissions={"canRead": True, "canWrite": True},
                    )
                    inherited_refs.append(ref_entity)
                except Exception:
                    ref_dto = ParameterContextReferenceDTO(id=ctx_id)
                    inherited_refs.append(ParameterContextReferenceEntity(id=ctx_id, component=ref_dto))

            existing_context.component.inherited_parameter_contexts = inherited_refs

    update_response = param_api.submit_parameter_context_update(
        context_id=context_id, body=existing_context
    )

    request_id = update_response.request.request_id
    max_attempts = 30

    for attempt in range(max_attempts):
        status_response = param_api.get_parameter_context_update(
            context_id=context_id, request_id=request_id
        )

        if status_response.request.complete:
            if hasattr(status_response.request, "failure_reason") and status_response.request.failure_reason:
                raise ValueError("Update failed: %s" % status_response.request.failure_reason)

            param_api.delete_update_request(context_id=context_id, request_id=request_id)

            updated_context = param_api.get_parameter_context(id=context_id)
            actual_count = (
                len(updated_context.component.parameters)
                if updated_context.component.parameters
                else 0
            )

            return {
                "id": context_id,
                "name": name or existing_context.component.name,
                "actual_parameter_count": actual_count,
            }

        time.sleep(0.5)

    raise ValueError("Update request timed out")


def delete_parameter_context(context_id: str) -> None:
    """Delete a parameter context."""
    param_api = ParameterContextsApi()
    existing_context = param_api.get_parameter_context(id=context_id)

    param_api.delete_parameter_context(
        id=context_id,
        version=existing_context.revision.version,
    )
