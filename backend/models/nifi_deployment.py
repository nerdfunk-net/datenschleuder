"""Pydantic schemas for NiFi deployment operations."""

from pydantic import BaseModel
from typing import Optional, Union, List, Dict, Any


class DeploymentRequest(BaseModel):
    """Model for deploying a flow from registry to NiFi instance."""

    template_id: Optional[int] = None
    bucket_id: Optional[str] = None
    flow_id: Optional[str] = None
    registry_client_id: Optional[str] = None
    parent_process_group_id: Optional[str] = None
    parent_process_group_path: Optional[str] = None
    process_group_name: Optional[str] = None
    hierarchy_attribute: Optional[str] = None
    version: Optional[Union[int, str]] = None
    x_position: Optional[int] = 0
    y_position: Optional[int] = 0
    parameter_context_id: Optional[str] = None
    parameter_context_name: Optional[str] = None
    stop_versioning_after_deploy: Optional[bool] = False
    disable_after_deploy: Optional[bool] = False
    start_after_deploy: Optional[bool] = False


class DeploymentResponse(BaseModel):
    """Response model for deployment operation."""

    status: str
    message: str
    process_group_id: Optional[str] = None
    process_group_name: Optional[str] = None
    instance_id: int
    bucket_id: str
    flow_id: str
    version: Optional[Union[int, str]] = None


class PortInfo(BaseModel):
    """Information about a NiFi port."""

    id: str
    name: str
    state: str
    comments: Optional[str] = None


class PortsResponse(BaseModel):
    """Response model for listing ports."""

    process_group_id: str
    process_group_name: Optional[str] = None
    ports: List[PortInfo]


class ConnectionRequest(BaseModel):
    """Request to create a connection between two ports/processors."""

    source_id: str
    target_id: str
    name: Optional[str] = None
    relationships: Optional[List[str]] = None


class ConnectionResponse(BaseModel):
    """Response model for connection creation."""

    status: str
    message: str
    connection_id: str
    source_id: str
    source_name: str
    target_id: str
    target_name: str


class DeploymentPathSettings(BaseModel):
    """Deployment path settings for a specific NiFi instance."""

    instance_id: int
    source_path: Optional[str] = None
    dest_path: Optional[str] = None


class DeploymentSettings(BaseModel):
    """Global deployment settings."""

    process_group_name_template: str = "{last_hierarchy_value}"
    disable_after_deploy: bool = False
    stop_versioning_after_deploy: bool = False


class ProcessorInfo(BaseModel):
    """Information about a NiFi processor."""

    id: str
    name: str
    type: str
    state: str
    parent_group_id: Optional[str] = None
    comments: Optional[str] = None


class ProcessorsResponse(BaseModel):
    """Response model for listing processors."""

    status: str
    process_group_id: str
    process_group_name: Optional[str] = None
    processors: List[ProcessorInfo]
    count: int


class InputPortInfo(BaseModel):
    """Information about a NiFi input port."""

    id: str
    name: str
    state: str
    parent_group_id: Optional[str] = None
    comments: Optional[str] = None
    concurrent_tasks: Optional[int] = None


class InputPortsResponse(BaseModel):
    """Response model for listing input ports."""

    status: str
    process_group_id: str
    process_group_name: Optional[str] = None
    input_ports: List[InputPortInfo]
    count: int


class ProcessorConfiguration(BaseModel):
    """Processor configuration details."""

    id: str
    name: str
    type: str
    state: str
    properties: Dict[str, Any]
    scheduling_period: Optional[str] = None
    scheduling_strategy: Optional[str] = None
    execution_node: Optional[str] = None
    penalty_duration: Optional[str] = None
    yield_duration: Optional[str] = None
    bulletin_level: Optional[str] = None
    comments: Optional[str] = None
    auto_terminated_relationships: Optional[List[str]] = None
    run_duration_millis: Optional[int] = None
    concurrent_tasks: Optional[int] = None


class ProcessorConfigurationResponse(BaseModel):
    """Response model for processor configuration."""

    status: str
    processor: ProcessorConfiguration


class ProcessorConfigurationUpdate(BaseModel):
    """Model for updating processor configuration."""

    name: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    scheduling_period: Optional[str] = None
    scheduling_strategy: Optional[str] = None
    execution_node: Optional[str] = None
    penalty_duration: Optional[str] = None
    yield_duration: Optional[str] = None
    bulletin_level: Optional[str] = None
    comments: Optional[str] = None
    auto_terminated_relationships: Optional[List[str]] = None
    run_duration_millis: Optional[int] = None
    concurrent_tasks: Optional[int] = None


class ProcessorConfigurationUpdateResponse(BaseModel):
    """Response model for processor configuration update."""

    status: str
    message: str
    processor_id: str
    processor_name: str


# ============================================================================
# Parameter Context Schemas
# ============================================================================


class ParameterEntity(BaseModel):
    """Model for a single parameter in a parameter context."""

    name: str
    description: Optional[str] = None
    sensitive: bool = False
    value: Optional[str] = None
    provided: bool = False
    referenced_attributes: Optional[List[str]] = None
    parameter_context_id: Optional[str] = None


class ParameterContext(BaseModel):
    """Model for a NiFi parameter context."""

    id: str
    name: str
    description: Optional[str] = None
    parameters: List[ParameterEntity] = []
    bound_process_groups: Optional[List[Dict[str, Any]]] = None
    inherited_parameter_contexts: Optional[List[str]] = None
    component_revision: Optional[Dict[str, Any]] = None
    permissions: Optional[Dict[str, Any]] = None


class ParameterContextListResponse(BaseModel):
    """Response model for listing parameter contexts."""

    status: str
    parameter_contexts: List[ParameterContext]
    count: int
    message: Optional[str] = None


class ParameterInput(BaseModel):
    """Input model for parameter creation/update."""

    name: str
    description: Optional[str] = None
    sensitive: bool = False
    value: Optional[str] = None


class ParameterContextCreate(BaseModel):
    """Model for creating a parameter context."""

    name: str
    description: Optional[str] = None
    parameters: List[ParameterInput] = []


class ParameterContextUpdate(BaseModel):
    """Model for updating a parameter context."""

    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[List[ParameterInput]] = None
    inherited_parameter_contexts: Optional[List[str]] = None


class AssignParameterContextRequest(BaseModel):
    """Model for assigning a parameter context to a process group."""

    parameter_context_id: str
    cascade: bool = False


class AssignParameterContextResponse(BaseModel):
    """Response model for assigning a parameter context."""

    status: str
    message: str
    process_group_id: str
    parameter_context_id: str
    cascade: bool
