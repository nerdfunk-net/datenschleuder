"""
NiFi Pydantic Models

All request/response schemas for NiFi operations.
Organized by domain:
  - Server Models
  - Instance Models
  - Cluster Models
  - Hierarchy Models
  - Flow & Registry Models
  - Deployment & Operations Models
"""

from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, Union, List, Dict, Any
from datetime import datetime


# ============================================================================
# Server Models (from nifi_server.py)
# ============================================================================


class NifiServerCreate(BaseModel):
    """Schema for creating a NiFi server."""

    server_id: str
    hostname: str
    credential_id: Optional[int] = None
    installation_type: str = "bare"


class NifiServerUpdate(BaseModel):
    """Schema for updating a NiFi server."""

    server_id: Optional[str] = None
    hostname: Optional[str] = None
    credential_id: Optional[int] = None
    installation_type: Optional[str] = None


class NifiServerResponse(BaseModel):
    """Schema for NiFi server response."""

    id: int
    server_id: str
    hostname: str
    credential_id: Optional[int] = None
    credential_name: Optional[str] = None
    installation_type: str = "bare"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Instance Models (from nifi_instance.py)
# ============================================================================


class NifiInstanceCreate(BaseModel):
    """Schema for creating a NiFi instance."""

    name: Optional[str] = None
    hierarchy_attribute: Optional[str] = None
    hierarchy_value: Optional[str] = None
    server_id: Optional[int] = None
    nifi_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    use_ssl: bool = True
    verify_ssl: bool = True
    certificate_name: Optional[str] = None
    check_hostname: bool = True
    oidc_provider_id: Optional[str] = None
    git_config_repo_id: Optional[int] = None


class NifiInstanceUpdate(BaseModel):
    """Schema for updating a NiFi instance."""

    name: Optional[str] = None
    server_id: Optional[int] = None
    nifi_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    use_ssl: Optional[bool] = None
    verify_ssl: Optional[bool] = None
    certificate_name: Optional[str] = None
    check_hostname: Optional[bool] = None
    oidc_provider_id: Optional[str] = None
    git_config_repo_id: Optional[int] = None


class NifiInstanceResponse(BaseModel):
    """Schema for NiFi instance response."""

    id: int
    name: Optional[str] = None
    hierarchy_attribute: Optional[str] = None
    hierarchy_value: Optional[str] = None
    server_id: Optional[int] = None
    nifi_url: str
    username: Optional[str] = None
    use_ssl: bool
    verify_ssl: bool
    certificate_name: Optional[str] = None
    check_hostname: bool
    oidc_provider_id: Optional[str] = None
    git_config_repo_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NifiInstanceTestConnection(BaseModel):
    """Schema for testing NiFi connection without saving."""

    nifi_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    use_ssl: bool = True
    verify_ssl: bool = True
    certificate_name: Optional[str] = None
    check_hostname: bool = True
    oidc_provider_id: Optional[str] = None


# ============================================================================
# Cluster Models (from nifi_cluster.py)
# ============================================================================


class NifiClusterMemberInput(BaseModel):
    """Input schema for a cluster member."""

    instance_id: int
    is_primary: bool = False


class NifiClusterCreate(BaseModel):
    """Schema for creating a NiFi cluster."""

    cluster_id: str
    hierarchy_attribute: str
    hierarchy_value: str
    members: List[NifiClusterMemberInput]


class NifiClusterUpdate(BaseModel):
    """Schema for updating a NiFi cluster."""

    cluster_id: Optional[str] = None
    hierarchy_attribute: Optional[str] = None
    hierarchy_value: Optional[str] = None
    members: Optional[List[NifiClusterMemberInput]] = None


class NifiClusterMemberResponse(BaseModel):
    """Response schema for a cluster member (NiFi instance)."""

    instance_id: int
    name: Optional[str]
    nifi_url: str
    is_primary: bool


class NifiClusterResponse(BaseModel):
    """Schema for NiFi cluster response."""

    id: int
    cluster_id: str
    hierarchy_attribute: str
    hierarchy_value: str
    members: List[NifiClusterMemberResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NifiClusterPrimaryResponse(BaseModel):
    """Response for the get-primary endpoint.

    Returns the primary NiFi instance of a cluster, with hierarchy metadata
    taken from the cluster (not the instance, where those fields are nullable).
    """

    instance_id: int
    name: Optional[str]
    hierarchy_attribute: str
    hierarchy_value: str
    nifi_url: str
    username: Optional[str]
    use_ssl: bool
    verify_ssl: bool
    certificate_name: Optional[str]
    check_hostname: bool
    oidc_provider_id: Optional[str]


# ============================================================================
# Hierarchy Models (from nifi_hierarchy.py)
# ============================================================================


class HierarchyValueCreate(BaseModel):
    """Schema for creating a hierarchy value."""

    attribute_name: str
    value: str


class HierarchyValueResponse(BaseModel):
    """Schema for hierarchy value response."""

    id: int
    attribute_name: str
    value: str
    created_at: datetime

    class Config:
        from_attributes = True


class HierarchyValuesRequest(BaseModel):
    """Schema for batch creating/updating values for an attribute."""

    attribute_name: str
    values: List[str]


class HierarchyAttribute(BaseModel):
    """Single attribute in the hierarchy."""

    name: str
    label: str
    order: int


class HierarchyConfig(BaseModel):
    """Hierarchical data format configuration."""

    hierarchy: List[HierarchyAttribute]

    @field_validator("hierarchy")
    @classmethod
    def validate_unique_names(cls, v):
        names = [attr.name for attr in v]
        if len(names) != len(set(names)):
            raise ValueError("Attribute names must be unique")
        return v


# ============================================================================
# Flow & Registry Models (from nifi_operations.py)
# ============================================================================


class NifiFlowCreate(BaseModel):
    """Schema for creating a NiFi flow."""

    hierarchy_values: dict
    name: Optional[str] = None
    contact: Optional[str] = None
    src_connection_param: str
    dest_connection_param: str
    src_template_id: Optional[int] = None
    dest_template_id: Optional[int] = None
    active: bool = True
    description: Optional[str] = None
    creator_name: Optional[str] = None


class NifiFlowUpdate(BaseModel):
    """Schema for updating a NiFi flow."""

    hierarchy_values: Optional[dict] = None
    name: Optional[str] = None
    contact: Optional[str] = None
    src_connection_param: Optional[str] = None
    dest_connection_param: Optional[str] = None
    src_template_id: Optional[int] = None
    dest_template_id: Optional[int] = None
    active: Optional[bool] = None
    description: Optional[str] = None


class NifiFlowResponse(BaseModel):
    """Schema for NiFi flow response."""

    id: int
    hierarchy_values: dict
    name: Optional[str] = None
    contact: Optional[str] = None
    src_connection_param: str
    dest_connection_param: str
    src_template_id: Optional[int] = None
    dest_template_id: Optional[int] = None
    active: bool
    description: Optional[str] = None
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegistryFlowCreate(BaseModel):
    """Schema for creating a registry flow."""

    nifi_instance_id: int
    nifi_instance_name: str
    nifi_instance_url: str
    registry_id: str
    registry_name: str
    bucket_id: str
    bucket_name: str
    flow_id: str
    flow_name: str
    flow_description: Optional[str] = None


class RegistryFlowResponse(BaseModel):
    """Schema for registry flow response."""

    id: int
    nifi_instance_id: int
    nifi_instance_name: str
    nifi_instance_url: str
    registry_id: str
    registry_name: str
    bucket_id: str
    bucket_name: str
    flow_id: str
    flow_name: str
    flow_description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegistryFlowMetadataItem(BaseModel):
    """A single metadata key-value pair for a registry flow."""

    key: str
    value: str
    is_mandatory: bool = False


class RegistryFlowMetadataResponse(BaseModel):
    """Response schema for a registry flow metadata entry."""

    id: int
    registry_flow_id: int
    key: str
    value: str
    is_mandatory: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegistryFlowMetadataSetRequest(BaseModel):
    """Request schema for setting (replacing) all metadata for a flow."""

    items: List[RegistryFlowMetadataItem]


class FlowViewCreate(BaseModel):
    """Schema for creating a flow view."""

    name: str
    description: Optional[str] = None
    visible_columns: List[str]
    column_widths: Optional[dict] = None
    is_default: bool = False


class FlowViewUpdate(BaseModel):
    """Schema for updating a flow view."""

    name: Optional[str] = None
    description: Optional[str] = None
    visible_columns: Optional[List[str]] = None
    column_widths: Optional[dict] = None
    is_default: Optional[bool] = None


class FlowViewResponse(BaseModel):
    """Schema for flow view response."""

    id: int
    name: str
    description: Optional[str] = None
    visible_columns: List[str]
    column_widths: Optional[dict] = None
    is_default: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Deployment & Operations Models (from nifi_deployment.py)
# ============================================================================


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
    inherited_parameter_contexts: Optional[List[str]] = None


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


class ProcessGroupLinkInfo(BaseModel):
    """Process group info for linking into the NiFi UI."""

    found: bool = False
    process_group_id: Optional[str] = None
    process_group_name: Optional[str] = None
    path: Optional[str] = None
    nifi_url: Optional[str] = None
    nifi_link: Optional[str] = None
    instance_id: Optional[int] = None


class FlowProcessGroupsResponse(BaseModel):
    """Response for /api/nifi/flows/{flow_id}/get-processgroups."""

    status: str
    flow_id: int
    source: ProcessGroupLinkInfo
    destination: ProcessGroupLinkInfo


class FlowFilterRequest(BaseModel):
    """Request body for POST /api/nifi/flows/filtered."""

    filters: Dict[str, Any]


# ============================================================================
# NiFi Certificate Store Models (from routers/nifi/certificates.py)
# ============================================================================


class NifiCertificateInfo(BaseModel):
    """NiFi client certificate name."""

    name: str


class NifiCertificatesResponse(BaseModel):
    certificates: List[NifiCertificateInfo]


class ReadStoreRequest(BaseModel):
    """Request to read a PKCS12 keystore or truststore from a git repository."""

    git_repo_id: int
    filename: str
    password: str


class ReadStoreResponse(BaseModel):
    """Certificate subject info extracted from a PKCS12 store."""

    subject: str
    issuer: str
    is_expired: bool
    fingerprint_sha256: str


class UploadStoreResponse(BaseModel):
    """Result of uploading a keystore or truststore to a git repository."""

    filename: str
    subject: str
    issuer: str
    is_expired: bool
    fingerprint_sha256: str
    commit_sha: str


# ============================================================================
# NiFi Install Models (from routers/nifi/install.py)
# ============================================================================


class PathStatus(BaseModel):
    """Status of a single process group path."""

    path: str
    exists: bool


class CheckPathResponse(BaseModel):
    """Response for the check-path endpoint."""

    status: List[PathStatus]
