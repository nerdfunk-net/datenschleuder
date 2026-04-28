"""
Router for Datenschleuder Agent management.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import require_permission, verify_token
from core.database import get_db
from models.agent import (
    AgentContainersResponse,
    AgentListResponse,
    AgentRepositoriesResponse,
    AgentStatusResponse,
    CommandHistoryItem,
    CommandHistoryResponse,
    CommandRequest,
    CommandResponse,
    ContainerInfo,
    GitRepoInfo,
    NifiDeployRequest,
)
from services.agent import AgentService
from services.settings.credentials_service import CredentialsService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/datenschleuder-agent",
    tags=["datenschleuder-agent"],
    responses={404: {"description": "Not found"}},
)


@router.get(
    "/list",
    response_model=AgentListResponse,
    dependencies=[Depends(require_permission("agents", "read"))],
)
def list_agents(db: Session = Depends(get_db)):
    """List all registered agents (reads from Redis heartbeat registry)."""
    try:
        service = AgentService(db)
        return {"agents": service.list_agents()}
    except Exception as exc:
        logger.error("Failed to list agents: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/{agent_id}/status",
    response_model=AgentStatusResponse,
    dependencies=[Depends(require_permission("agents", "read"))],
)
def get_agent_status(agent_id: str, db: Session = Depends(get_db)):
    """Get the current status of a specific agent."""
    try:
        service = AgentService(db)
        status = service.get_agent_status(agent_id)
        if not status:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        return status
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to get agent status: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/{agent_id}/repositories",
    response_model=AgentRepositoriesResponse,
    dependencies=[Depends(require_permission("agents", "read"))],
)
def get_agent_repositories(agent_id: str, db: Session = Depends(get_db)):
    """Return the list of git repositories configured on the agent (read from Redis heartbeat)."""
    try:
        service = AgentService(db)
        status = service.get_agent_status(agent_id)
        if not status:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        repos = service.get_agent_repositories(agent_id)
        return AgentRepositoriesResponse(
            agent_id=agent_id,
            repositories=[GitRepoInfo(id=r["id"]) for r in repos],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to get agent repositories: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/{agent_id}/containers",
    response_model=AgentContainersResponse,
    dependencies=[Depends(require_permission("agents", "read"))],
)
def get_agent_containers(agent_id: str, db: Session = Depends(get_db)):
    """Return the list of docker containers configured on the agent (read from Redis heartbeat)."""
    try:
        service = AgentService(db)
        status = service.get_agent_status(agent_id)
        if not status:
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        containers = service.get_agent_containers(agent_id)
        return AgentContainersResponse(
            agent_id=agent_id,
            containers=[ContainerInfo(id=c["id"], type=c["type"]) for c in containers],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to get agent containers: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/command",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("agents", "execute"))],
)
def send_command(
    request: CommandRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Send a command to an agent and wait for the result."""
    try:
        service = AgentService(db)
        result = service.send_command_and_wait(
            agent_id=request.agent_id,
            command=request.command,
            params=request.params,
            sent_by=user.get("sub", "system"),
        )
        if result["status"] in ("error", "timeout"):
            status_code = 504 if result["status"] == "timeout" else 500
            raise HTTPException(status_code=status_code, detail=result.get("error"))
        return CommandResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to send command: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/{agent_id}/git-pull",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("agents", "execute"))],
)
def git_pull(
    agent_id: str,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Send a git_pull command and wait up to 30 s for the result."""
    try:
        service = AgentService(db)
        result = service.send_git_pull(agent_id, sent_by=user.get("sub", "system"))
        if result["status"] in ("error", "timeout"):
            status_code = 504 if result["status"] == "timeout" else 500
            raise HTTPException(status_code=status_code, detail=result.get("error"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Git pull failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/{agent_id}/docker-restart",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("agents", "execute"))],
)
def docker_restart(
    agent_id: str,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Send a docker_restart command and wait up to 60 s for the result."""
    try:
        service = AgentService(db)
        result = service.send_docker_restart(
            agent_id, sent_by=user.get("sub", "system")
        )
        if result["status"] in ("error", "timeout"):
            status_code = 504 if result["status"] == "timeout" else 500
            raise HTTPException(status_code=status_code, detail=result.get("error"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Docker restart failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/{agent_id}/deploy-nifi",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("agents", "execute"))],
)
def deploy_nifi(
    agent_id: str,
    request: NifiDeployRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Write docker-compose.yml and initialise the NiFi conf git repo via the agent."""
    try:
        creds_service = CredentialsService()

        credential_params: dict = {}
        if request.credential_id is not None:
            cred = creds_service.get_credential_by_id(request.credential_id)
            if cred is None:
                raise HTTPException(status_code=404, detail=f"Credential {request.credential_id} not found")
            if cred.get("type") == "ssh_key":
                credential_params["git_ssh_key"] = creds_service.get_decrypted_ssh_key(request.credential_id)
                credential_params["git_username"] = cred.get("username")
            else:
                credential_params["git_username"] = cred.get("username")
                credential_params["git_password"] = creds_service.get_decrypted_password(request.credential_id)

        params = {
            "target_directory": request.target_directory,
            "compose_content": request.compose_content,
            "create_directories": request.create_directories,
            "volume_dirs": request.volume_dirs,
            "conf_dir": request.conf_dir,
            "git_repo_url": request.git_repo_url,
            "git_branch": request.git_branch,
            **credential_params,
        }

        service = AgentService(db)
        result = service.send_command_and_wait(
            agent_id=agent_id,
            command="deploy_nifi",
            params=params,
            sent_by=user.get("sub", "system"),
            timeout=120,
        )

        if result["status"] in ("error", "timeout"):
            status_code = 504 if result["status"] == "timeout" else 500
            raise HTTPException(status_code=status_code, detail=result.get("error"))

        return CommandResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("NiFi deploy failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/{agent_id}/history",
    response_model=CommandHistoryResponse,
    dependencies=[Depends(require_permission("agents", "read"))],
)
def get_command_history(
    agent_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Return recent command history for a specific agent."""
    try:
        service = AgentService(db)
        commands = service.get_command_history(agent_id, limit)
        total = service.repository.count_commands(agent_id)
        return {
            "commands": [CommandHistoryItem.from_orm(c) for c in commands],
            "total": total,
        }
    except Exception as exc:
        logger.error("Failed to get command history: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/history/all",
    response_model=CommandHistoryResponse,
    dependencies=[Depends(require_permission("agents", "read"))],
)
def get_all_command_history(limit: int = 100, db: Session = Depends(get_db)):
    """Return recent command history across all agents."""
    try:
        service = AgentService(db)
        commands = service.get_all_command_history(limit)
        total = service.repository.count_commands()
        return {
            "commands": [CommandHistoryItem.from_orm(c) for c in commands],
            "total": total,
        }
    except Exception as exc:
        logger.error("Failed to get all command history: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
