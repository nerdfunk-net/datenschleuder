"""Role-Based Access Control service.

Implements flexible permission management with:
- Roles: Groups of permissions
- Permissions: Granular access control (resource + action)
- User-Role mapping
- User-Permission overrides

Permission Resolution:
1. Check user-specific permission overrides (highest priority)
2. Check role-based permissions
3. Default deny
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Tuple
from repositories.auth.rbac_repository import RBACRepository
from repositories.auth.user_repository import UserRepository
from core.models import Role, Permission

logger = logging.getLogger(__name__)


def _role_to_dict(role: Role) -> Dict[str, Any]:
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_system": role.is_system,
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }


def _permission_to_dict(permission: Permission) -> Dict[str, Any]:
    return {
        "id": permission.id,
        "resource": permission.resource,
        "action": permission.action,
        "description": permission.description,
        "created_at": permission.created_at.isoformat()
        if permission.created_at
        else None,
    }


class RBACService:
    def __init__(self):
        self.rbac_repo = RBACRepository()
        self.user_repo = UserRepository()

    # ── Permission Management ─────────────────────────────────────────────────

    def create_permission(
        self, resource: str, action: str, description: str = ""
    ) -> Dict[str, Any]:
        existing = self.rbac_repo.get_permission(resource, action)
        if existing:
            raise ValueError(f"Permission {resource}:{action} already exists")
        permission = self.rbac_repo.create_permission(resource, action, description)
        return _permission_to_dict(permission)

    def get_permission(self, resource: str, action: str) -> Optional[Dict[str, Any]]:
        permission = self.rbac_repo.get_permission(resource, action)
        return _permission_to_dict(permission) if permission else None

    def get_permission_by_id(self, permission_id: int) -> Optional[Dict[str, Any]]:
        permission = self.rbac_repo.get_permission_by_id(permission_id)
        return _permission_to_dict(permission) if permission else None

    def list_permissions(self) -> List[Dict[str, Any]]:
        return [_permission_to_dict(p) for p in self.rbac_repo.list_permissions()]

    def delete_permission(self, permission_id: int) -> None:
        self.rbac_repo.delete_permission(permission_id)

    # ── Role Management ───────────────────────────────────────────────────────

    def create_role(
        self, name: str, description: str = "", is_system: bool = False
    ) -> Dict[str, Any]:
        if self.rbac_repo.role_name_exists(name):
            raise ValueError(f"Role '{name}' already exists")
        role = self.rbac_repo.create_role(name, description, is_system)
        return _role_to_dict(role)

    def get_role(self, role_id: int) -> Optional[Dict[str, Any]]:
        role = self.rbac_repo.get_role(role_id)
        return _role_to_dict(role) if role else None

    def get_role_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        role = self.rbac_repo.get_role_by_name(name)
        return _role_to_dict(role) if role else None

    def list_roles(self) -> List[Dict[str, Any]]:
        return [_role_to_dict(r) for r in self.rbac_repo.list_roles()]

    def update_role(
        self,
        role_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        role = self.rbac_repo.get_role(role_id)
        if not role:
            raise ValueError(f"Role with id {role_id} not found")
        updates = {}
        if name is not None:
            updates["name"] = name
        if description is not None:
            updates["description"] = description
        updated_role = self.rbac_repo.update_role(role_id, **updates)
        return _role_to_dict(updated_role)

    def delete_role(self, role_id: int) -> None:
        role = self.rbac_repo.get_role(role_id)
        if not role:
            raise ValueError(f"Role with id {role_id} not found")
        if role.is_system:
            raise ValueError("Cannot delete system role")
        self.rbac_repo.delete_role(role_id)

    # ── Role-Permission Assignment ────────────────────────────────────────────

    def assign_permission_to_role(
        self, role_id: int, permission_id: int, granted: bool = True
    ) -> None:
        self.rbac_repo.assign_permission_to_role(role_id, permission_id, granted)

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> None:
        self.rbac_repo.remove_permission_from_role(role_id, permission_id)

    def get_role_permissions(self, role_id: int) -> List[Dict[str, Any]]:
        return [
            _permission_to_dict(p) for p in self.rbac_repo.get_role_permissions(role_id)
        ]

    # ── User-Role Assignment ──────────────────────────────────────────────────

    def assign_role_to_user(self, user_id: int, role_id: int) -> None:
        self.rbac_repo.assign_role_to_user(user_id, role_id)

    def remove_role_from_user(self, user_id: int, role_id: int) -> None:
        self.rbac_repo.remove_role_from_user(user_id, role_id)

    def get_user_roles(self, user_id: int) -> List[Dict[str, Any]]:
        return [_role_to_dict(r) for r in self.rbac_repo.get_user_roles(user_id)]

    def get_users_with_role(self, role_id: int) -> List[int]:
        return self.rbac_repo.get_users_with_role(role_id)

    # ── User-Permission Overrides ─────────────────────────────────────────────

    def assign_permission_to_user(
        self, user_id: int, permission_id: int, granted: bool = True
    ) -> None:
        self.rbac_repo.assign_permission_to_user(user_id, permission_id, granted)

    def remove_permission_from_user(self, user_id: int, permission_id: int) -> None:
        self.rbac_repo.remove_permission_from_user(user_id, permission_id)

    def get_user_permission_overrides(self, user_id: int) -> List[Dict[str, Any]]:
        overrides = self.rbac_repo.get_user_permission_overrides_with_status(user_id)
        result = []
        for permission, granted in overrides:
            perm_dict = _permission_to_dict(permission)
            perm_dict["granted"] = granted
            perm_dict["source"] = "override"
            result.append(perm_dict)
        return result

    # ── Permission Checking ───────────────────────────────────────────────────

    def has_permission(self, user_id: int, resource: str, action: str) -> bool:
        permission = self.rbac_repo.get_permission(resource, action)
        if not permission:
            return False
        override = self.rbac_repo.get_user_permission_override(user_id, permission.id)
        if override is not None:
            return override
        user_roles = self.rbac_repo.get_user_roles(user_id)
        for role in user_roles:
            role_permissions = self.rbac_repo.get_role_permissions(role.id)
            if any(p.id == permission.id for p in role_permissions):
                return True
        return False

    def get_user_permissions(self, user_id: int) -> List[Dict[str, Any]]:
        permissions_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
        user_roles = self.rbac_repo.get_user_roles(user_id)
        for role in user_roles:
            role_permissions = self.rbac_repo.get_role_permissions(role.id)
            for perm in role_permissions:
                key = (perm.resource, perm.action)
                if key not in permissions_map:
                    perm_dict = _permission_to_dict(perm)
                    perm_dict["granted"] = True
                    perm_dict["source"] = "role"
                    permissions_map[key] = perm_dict
        user_permissions = self.rbac_repo.get_user_permissions(user_id)
        for perm in user_permissions:
            key = (perm.resource, perm.action)
            perm_dict = _permission_to_dict(perm)
            perm_dict["granted"] = True
            perm_dict["source"] = "override"
            permissions_map[key] = perm_dict
        granted_perms = [p for p in permissions_map.values() if p.get("granted", False)]
        granted_perms.sort(key=lambda x: (x["resource"], x["action"]))
        return granted_perms

    def check_any_permission(
        self, user_id: int, resource: str, actions: List[str]
    ) -> bool:
        return any(self.has_permission(user_id, resource, action) for action in actions)

    def check_all_permissions(
        self, user_id: int, resource: str, actions: List[str]
    ) -> bool:
        return all(self.has_permission(user_id, resource, action) for action in actions)

    # ── Compound User+RBAC Operations ────────────────────────────────────────

    def _user_to_dict(self, user) -> Dict[str, Any]:
        return {
            "id": user.id,
            "username": user.username,
            "realname": user.realname,
            "email": user.email,
            "permissions": user.permissions,
            "debug": user.debug,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        }

    def create_user_with_roles(
        self,
        username: str,
        realname: str,
        password: str,
        email: Optional[str] = None,
        role_ids: Optional[List[int]] = None,
        debug: bool = False,
        is_active: bool = True,
    ) -> Dict[str, Any]:
        from services.auth.user_service import UserService

        user_svc = UserService()
        user = user_svc.create_user(
            username=username,
            realname=realname,
            password=password,
            email=email,
            permissions=1,
            debug=debug,
            is_active=is_active,
        )
        if role_ids:
            for role_id in role_ids:
                role = self.get_role(role_id)
                if not role:
                    user_svc.hard_delete_user(user["id"])
                    raise ValueError(f"Role with id {role_id} not found")
                self.assign_role_to_user(user["id"], role_id)
        return user

    def get_user_with_rbac(
        self, user_id: int, include_inactive: bool = False
    ) -> Optional[Dict[str, Any]]:
        from services.auth.user_service import UserService

        user_svc = UserService()
        user = user_svc.get_user_by_id(user_id, include_inactive=include_inactive)
        if not user:
            return None
        user["roles"] = self.get_user_roles(user_id)
        user["permissions"] = self.get_user_permissions(user_id)
        return user

    def list_users_with_rbac(
        self, include_inactive: bool = True
    ) -> List[Dict[str, Any]]:
        from services.auth.user_service import UserService

        user_svc = UserService()
        users = user_svc.get_all_users(include_inactive=include_inactive)
        for user in users:
            user["roles"] = self.get_user_roles(user["id"])
            user["permissions"] = self.get_user_permissions(user["id"])
        return users

    def update_user_profile(
        self,
        user_id: int,
        realname: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        from services.auth.user_service import UserService

        return UserService().update_user(
            user_id=user_id,
            realname=realname,
            email=email,
            password=password,
            permissions=None,
            debug=None,
            is_active=is_active,
        )

    def delete_user_with_rbac(self, user_id: int) -> bool:
        from services.auth.user_service import UserService

        user_svc = UserService()
        user = user_svc.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return False
        username = user.get("username")
        roles = self.get_user_roles(user_id)
        for role in roles:
            self.remove_role_from_user(user_id, role["id"])
        overrides = self.get_user_permission_overrides(user_id)
        for override in overrides:
            self.remove_permission_from_user(user_id, override["id"])
        if username:
            try:
                from services.settings.credentials_service import CredentialsService

                deleted_count = CredentialsService().delete_credentials_by_owner(
                    username
                )
                logger.info(
                    "Deleted %s private credentials for user %s",
                    deleted_count,
                    username,
                )
            except Exception as e:
                logger.warning(
                    "Failed to delete credentials for user %s: %s", username, e
                )
            try:
                from services.auth.profile_service import ProfileService

                ProfileService().delete_user_profile(username)
                logger.info("Deleted profile for user %s", username)
            except Exception as e:
                logger.warning("Failed to delete profile for user %s: %s", username, e)
        return user_svc.hard_delete_user(user_id)

    def bulk_delete_users_with_rbac(self, user_ids: List[int]) -> Tuple[int, List[str]]:
        success_count = 0
        errors = []
        for user_id in user_ids:
            try:
                if self.delete_user_with_rbac(user_id):
                    success_count += 1
                else:
                    errors.append(f"User {user_id} not found")
            except Exception as e:
                errors.append(f"User {user_id}: {str(e)}")
        return success_count, errors

    def toggle_user_activation(self, user_id: int) -> Optional[Dict[str, Any]]:
        from services.auth.user_service import UserService

        user_svc = UserService()
        user = user_svc.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return None
        return user_svc.update_user(user_id, is_active=not user["is_active"])

    def toggle_user_debug(self, user_id: int) -> Optional[Dict[str, Any]]:
        from services.auth.user_service import UserService

        user_svc = UserService()
        user = user_svc.get_user_by_id(user_id)
        if not user:
            return None
        return user_svc.update_user(user_id, debug=not user["debug"])
