"""
Pydantic models for Datenschleuder Agent API.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AgentStatusResponse(BaseModel):
    """Agent health status read from Redis heartbeat."""

    agent_id: str
    status: str  # online, offline
    last_heartbeat: int
    version: str
    hostname: str
    capabilities: str
    started_at: int
    commands_executed: int
    redis_server_id: Optional[int] = None
    redis_server_name: Optional[str] = None


class AgentListResponse(BaseModel):
    """List of all registered agents."""

    agents: List[AgentStatusResponse]


class CommandRequest(BaseModel):
    """Generic command request."""

    agent_id: str = Field(..., description="Agent ID")
    command: str = Field(
        ..., description="Command name (echo, git_pull, docker_restart, git_status)"
    )
    params: Dict[str, Any] = Field(
        default_factory=dict, description="Command parameters"
    )


class CommandResponse(BaseModel):
    """Response after command execution."""

    command_id: str
    status: str  # success, error, timeout, pending
    output: Optional[str] = None
    error: Optional[str] = None
    execution_time_ms: int
    parsed_output: Optional[List[Dict[str, Any]]] = None


class GitRepoInfo(BaseModel):
    id: str


class AgentRepositoriesResponse(BaseModel):
    agent_id: str
    repositories: List[GitRepoInfo]


class ContainerInfo(BaseModel):
    id: str
    type: str


class AgentContainersResponse(BaseModel):
    agent_id: str
    containers: List[ContainerInfo]


class CommandHistoryItem(BaseModel):
    """Single command history record."""

    id: int
    agent_id: str
    command_id: str
    command: str
    params: Optional[str] = None
    status: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None
    sent_at: datetime
    completed_at: Optional[datetime] = None
    sent_by: Optional[str] = None
    redis_server_id: Optional[int] = None

    class Config:
        from_attributes = True


class CommandHistoryResponse(BaseModel):
    """Paginated command history."""

    commands: List[CommandHistoryItem]
    total: int


class NifiDeployRequest(BaseModel):
    """Request payload for the deploy-nifi agent command."""

    target_directory: str = Field(..., description="Absolute path on the agent host where docker-compose.yml is written")
    compose_content: str = Field(..., description="Full content of the docker-compose.yml file")
    create_directories: bool = Field(default=False, description="Create NiFi volume directories if they do not exist")
    volume_dirs: Dict[str, str] = Field(default_factory=dict, description="Map of volume key → relative path for NiFi directories")
    conf_dir: Optional[str] = Field(default=None, description="Relative path of the NiFi conf directory (SRC_CONF_DIR); git repo is cloned here")
    git_repo_url: Optional[str] = Field(default=None, description="URL of the git repository to clone into conf_dir")
    git_branch: str = Field(default="main", description="Git branch to clone or pull")
    credential_id: Optional[int] = Field(default=None, description="ID of the credential record to use for git authentication")
