"""
Redis server configuration router.

Provides CRUD endpoints for managing Redis server connections.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException

from core.auth import require_permission
from models.settings import RedisServerCreate, RedisServerUpdate
from services.settings.redis_service import redis_service

router = APIRouter(prefix="/api/settings/redis", tags=["settings", "redis"])


@router.get("/")
def list_redis_servers(
    current_user: dict = Depends(require_permission("settings.redis", "read")),
):
    """Return all configured Redis servers."""
    servers = redis_service.list_servers()
    return {"success": True, "data": servers, "count": len(servers)}


@router.get("/{server_id}")
def get_redis_server(
    server_id: int,
    current_user: dict = Depends(require_permission("settings.redis", "read")),
):
    """Return a single Redis server by ID."""
    server = redis_service.get_server(server_id)
    if server is None:
        raise HTTPException(status_code=404, detail="Redis server not found")
    return {"success": True, "data": server}


@router.post("/", status_code=201)
def create_redis_server(
    data: RedisServerCreate,
    current_user: dict = Depends(require_permission("settings.redis", "write")),
):
    """Create a new Redis server configuration."""
    server = redis_service.create_server(data)
    return {"success": True, "data": server}


@router.put("/{server_id}")
def update_redis_server(
    server_id: int,
    data: RedisServerUpdate,
    current_user: dict = Depends(require_permission("settings.redis", "write")),
):
    """Update an existing Redis server configuration."""
    server = redis_service.update_server(server_id, data)
    if server is None:
        raise HTTPException(status_code=404, detail="Redis server not found")
    return {"success": True, "data": server}


@router.delete("/{server_id}")
def delete_redis_server(
    server_id: int,
    current_user: dict = Depends(require_permission("settings.redis", "write")),
):
    """Delete a Redis server configuration."""
    deleted = redis_service.delete_server(server_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Redis server not found")
    return {"success": True, "message": "Redis server deleted"}


@router.post("/{server_id}/test-connection")
def test_redis_connection(
    server_id: int,
    current_user: dict = Depends(require_permission("settings.redis", "read")),
):
    """Test connectivity to a stored Redis server."""
    try:
        result = redis_service.test_connection(server_id)
        return {"success": True, "status": "connected", "details": result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"connected": False, "error": str(exc)},
        )
