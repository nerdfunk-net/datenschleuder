"""User management service.

Provides core user CRUD operations and authentication.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from core.auth import get_password_hash, verify_password
from repositories.auth.user_repository import UserRepository
from core.models import User

# Permission bit flags (legacy bitmask system)
PERMISSION_READ = 1
PERMISSION_WRITE = 2
PERMISSION_ADMIN = 4
PERMISSION_DELETE = 8
PERMISSION_USER_MANAGE = 16

PERMISSIONS_VIEWER = PERMISSION_READ
PERMISSIONS_USER = PERMISSION_READ | PERMISSION_WRITE
PERMISSIONS_ADMIN = (
    PERMISSION_READ | PERMISSION_WRITE | PERMISSION_ADMIN | PERMISSION_DELETE | PERMISSION_USER_MANAGE
)


def _user_to_dict(user: User) -> Dict[str, Any]:
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


class UserService:
    def __init__(self):
        self.user_repo = UserRepository()

    def create_user(
        self,
        username: str,
        realname: str,
        password: str,
        email: Optional[str] = None,
        permissions: int = PERMISSIONS_USER,
        debug: bool = False,
        is_active: bool = True,
    ) -> Dict[str, Any]:
        if not username or not realname or not password:
            raise ValueError("Username, realname, and password are required")
        if self.user_repo.username_exists(username):
            raise ValueError(f"Username '{username}' already exists")
        hashed_password = get_password_hash(password)
        user = self.user_repo.create(
            username=username,
            realname=realname,
            email=email or "",
            password=hashed_password,
            permissions=permissions,
            debug=debug,
            is_active=is_active,
        )
        return _user_to_dict(user)

    def get_all_users(self, include_inactive: bool = True) -> List[Dict[str, Any]]:
        if include_inactive:
            users = self.user_repo.get_all()
        else:
            users = self.user_repo.get_active_users()
        return [_user_to_dict(u) for u in users]

    def get_user_by_id(self, user_id: int, include_inactive: bool = False) -> Optional[Dict[str, Any]]:
        user = self.user_repo.get_by_id(user_id)
        if user and (include_inactive or user.is_active):
            return _user_to_dict(user)
        return None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        user = self.user_repo.get_by_username(username)
        if user and user.is_active:
            return _user_to_dict(user)
        return None

    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        user = self.user_repo.get_by_username(username)
        if user and user.is_active and verify_password(password, user.password):
            return _user_to_dict(user)
        return None

    def update_user(
        self,
        user_id: int,
        realname: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        permissions: Optional[int] = None,
        debug: Optional[bool] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        current_user = self.user_repo.get_by_id(user_id)
        if not current_user:
            return None
        updates = {}
        if realname is not None:
            updates["realname"] = realname
        if email is not None:
            updates["email"] = email
        if password is not None:
            if len(password) < 8:
                raise ValueError("Password must be at least 8 characters long")
            updates["password"] = get_password_hash(password)
        if permissions is not None:
            updates["permissions"] = permissions
        if debug is not None:
            updates["debug"] = debug
        if is_active is not None:
            updates["is_active"] = is_active
        if not updates:
            return _user_to_dict(current_user)
        updated_user = self.user_repo.update(user_id, **updates)
        return _user_to_dict(updated_user) if updated_user else None

    def delete_user(self, user_id: int) -> bool:
        return self.user_repo.set_active_status(user_id, False)

    def hard_delete_user(self, user_id: int) -> bool:
        return self.user_repo.delete(user_id)

    def bulk_delete_users(self, user_ids: List[int]) -> Tuple[int, List[str]]:
        success_count = 0
        errors = []
        for user_id in user_ids:
            try:
                if self.delete_user(user_id):
                    success_count += 1
                else:
                    errors.append(f"User ID {user_id} not found")
            except Exception as e:
                errors.append(f"Failed to delete user ID {user_id}: {str(e)}")
        return success_count, errors

    def bulk_hard_delete_users(self, user_ids: List[int]) -> Tuple[int, List[str]]:
        success_count = 0
        errors = []
        for user_id in user_ids:
            try:
                if self.hard_delete_user(user_id):
                    success_count += 1
                else:
                    errors.append(f"User ID {user_id} not found")
            except Exception as e:
                errors.append(f"Failed to delete user ID {user_id}: {str(e)}")
        return success_count, errors

    def bulk_update_permissions(self, user_ids: List[int], permissions: int) -> Tuple[int, List[str]]:
        success_count = 0
        errors = []
        for user_id in user_ids:
            try:
                if self.update_user(user_id, permissions=permissions):
                    success_count += 1
                else:
                    errors.append(f"User ID {user_id} not found")
            except Exception as e:
                errors.append(f"Failed to update permissions for user ID {user_id}: {str(e)}")
        return success_count, errors

    def has_permission(self, user: Dict[str, Any], permission: int) -> bool:
        return bool(user["permissions"] & permission)

    def get_permission_name(self, permission: int) -> str:
        permissions = []
        if permission & PERMISSION_READ:
            permissions.append("Read")
        if permission & PERMISSION_WRITE:
            permissions.append("Write")
        if permission & PERMISSION_ADMIN:
            permissions.append("Admin")
        if permission & PERMISSION_DELETE:
            permissions.append("Delete")
        if permission & PERMISSION_USER_MANAGE:
            permissions.append("User Management")
        return ", ".join(permissions) if permissions else "None"

    def get_role_name(self, permissions: int) -> str:
        if permissions == PERMISSIONS_ADMIN:
            return "admin"
        elif permissions == PERMISSIONS_USER:
            return "user"
        elif permissions == PERMISSIONS_VIEWER:
            return "viewer"
        return "custom"

    def get_permissions_for_role(self, role: str) -> int:
        role_map = {
            "admin": PERMISSIONS_ADMIN,
            "user": PERMISSIONS_USER,
            "viewer": PERMISSIONS_VIEWER,
        }
        return role_map.get(role, PERMISSIONS_USER)

    def ensure_admin_user_permissions(self) -> None:
        admin_user = self.user_repo.get_by_username("admin")
        if admin_user and admin_user.permissions != PERMISSIONS_ADMIN:
            self.user_repo.update(admin_user.id, permissions=PERMISSIONS_ADMIN)

    def _ensure_admin_role_assigned(self, user_id: Optional[int] = None) -> None:
        try:
            from services.auth.rbac_service import RBACService
            rbac = RBACService()
            if user_id is None:
                admin_user = self.get_user_by_username("admin")
                if not admin_user:
                    return
                user_id = admin_user["id"]
            admin_role = rbac.get_role_by_name("admin")
            if not admin_role:
                try:
                    from tools import seed_rbac
                    seed_rbac.main(verbose=False)
                    admin_role = rbac.get_role_by_name("admin")
                    import logging
                    logging.getLogger(__name__).info("Initialized RBAC system with default roles and permissions")
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("Failed to seed RBAC: %s", e)
                    return
            if admin_role:
                user_roles = rbac.get_user_roles(user_id)
                if not any(role["name"] == "admin" for role in user_roles):
                    rbac.assign_role_to_user(user_id, admin_role["id"])
                    import logging
                    logging.getLogger(__name__).info("Assigned admin role to user ID %s", user_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to ensure admin role assignment: %s", e)

    def _create_default_admin_without_rbac(self) -> Optional[Dict[str, Any]]:
        user_count = self.user_repo.count()
        if user_count > 0:
            self.ensure_admin_user_permissions()
            return None
        try:
            from config import settings as config_settings
            admin_user = self.create_user(
                username="admin",
                realname="System Administrator",
                password=config_settings.initial_password,
                email="admin@localhost",
                permissions=PERMISSIONS_ADMIN,
                debug=True,
            )
            import logging
            logging.getLogger(__name__).info("Created default admin user (RBAC role will be assigned at startup)")
            return admin_user
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to create default admin: %s", e)
            return None

    def ensure_admin_has_rbac_role(self) -> None:
        try:
            self._create_default_admin_without_rbac()
            admin_user = self.get_user_by_username("admin")
            if admin_user:
                self._ensure_admin_role_assigned(admin_user["id"])
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to ensure admin RBAC role: %s", e)
