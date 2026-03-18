"""
RBAC repository for role and permission database operations.
"""

from contextlib import contextmanager
from typing import Generator, Optional, List
from sqlalchemy import and_
from sqlalchemy.orm import Session
from repositories.base import BaseRepository
from core.models import Role, Permission, RolePermission, UserRole, UserPermission
from core.database import get_db_session


class RBACRepository(BaseRepository):
    """Repository for Role-Based Access Control operations.

    Manages 5 models across 5 logical sections:
    - Permission CRUD (create_permission, get_permission, list_permissions, delete_permission)
    - Role CRUD (create_role, get_role, get_role_by_name, list_roles, update_role, delete_role, role_name_exists)
    - Role-Permission assignments (assign_permission_to_role, remove_permission_from_role, get_role_permissions)
    - User-Role assignments (assign_role_to_user, remove_role_from_user, get_user_roles, get_users_with_role)
    - User-Permission overrides (assign_permission_to_user, remove_permission_from_user,
      get_user_permissions, get_user_permission_override, get_user_permission_overrides_with_status)

    Note: Does not call super().__init__() because it manages multiple models.
    Session lifecycle is handled by the _session() context manager.
    """

    def __init__(self):
        # RBAC has multiple models, so we don't call super().__init__()
        pass

    @contextmanager
    def _session(self) -> Generator[Session, None, None]:
        """Context manager that opens and closes a DB session."""
        db = get_db_session()
        try:
            yield db
        finally:
            db.close()

    # ========================================================================
    # Permission Operations
    # ========================================================================

    def create_permission(
        self, resource: str, action: str, description: str = ""
    ) -> Permission:
        """Create a new permission."""
        with self._session() as db:
            permission = Permission(
                resource=resource, action=action, description=description
            )
            db.add(permission)
            db.commit()
            db.refresh(permission)
            return permission

    def get_permission(self, resource: str, action: str) -> Optional[Permission]:
        """Get permission by resource and action."""
        with self._session() as db:
            return (
                db.query(Permission)
                .filter(
                    and_(Permission.resource == resource, Permission.action == action)
                )
                .first()
            )

    def get_permission_by_id(self, permission_id: int) -> Optional[Permission]:
        """Get permission by ID."""
        with self._session() as db:
            return db.query(Permission).filter(Permission.id == permission_id).first()

    def list_permissions(self) -> List[Permission]:
        """Get all permissions."""
        with self._session() as db:
            return (
                db.query(Permission)
                .order_by(Permission.resource, Permission.action)
                .all()
            )

    def delete_permission(self, permission_id: int) -> bool:
        """Delete a permission."""
        with self._session() as db:
            permission = (
                db.query(Permission).filter(Permission.id == permission_id).first()
            )
            if permission:
                db.delete(permission)
                db.commit()
                return True
            return False

    # ========================================================================
    # Role Operations
    # ========================================================================

    def create_role(
        self, name: str, description: str = "", is_system: bool = False
    ) -> Role:
        """Create a new role."""
        with self._session() as db:
            role = Role(name=name, description=description, is_system=is_system)
            db.add(role)
            db.commit()
            db.refresh(role)
            return role

    def get_role(self, role_id: int) -> Optional[Role]:
        """Get role by ID."""
        with self._session() as db:
            return db.query(Role).filter(Role.id == role_id).first()

    def get_role_by_name(self, name: str) -> Optional[Role]:
        """Get role by name."""
        with self._session() as db:
            return db.query(Role).filter(Role.name == name).first()

    def list_roles(self) -> List[Role]:
        """Get all roles."""
        with self._session() as db:
            return db.query(Role).order_by(Role.name).all()

    def update_role(self, role_id: int, **kwargs) -> Optional[Role]:
        """Update a role."""
        with self._session() as db:
            role = db.query(Role).filter(Role.id == role_id).first()
            if role:
                for key, value in kwargs.items():
                    if hasattr(role, key):
                        setattr(role, key, value)
                db.commit()
                db.refresh(role)
            return role

    def delete_role(self, role_id: int) -> bool:
        """Delete a role."""
        with self._session() as db:
            role = db.query(Role).filter(Role.id == role_id).first()
            if role:
                db.delete(role)
                db.commit()
                return True
            return False

    def role_name_exists(self, name: str) -> bool:
        """Check if role name exists."""
        with self._session() as db:
            return db.query(Role).filter(Role.name == name).count() > 0

    # ========================================================================
    # Role-Permission Operations
    # ========================================================================

    def assign_permission_to_role(
        self, role_id: int, permission_id: int, granted: bool = True
    ) -> RolePermission:
        """Assign permission to role."""
        with self._session() as db:
            existing = (
                db.query(RolePermission)
                .filter(
                    and_(
                        RolePermission.role_id == role_id,
                        RolePermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if existing:
                existing.granted = granted
                db.commit()
                db.refresh(existing)
                return existing

            role_perm = RolePermission(
                role_id=role_id, permission_id=permission_id, granted=granted
            )
            db.add(role_perm)
            db.commit()
            db.refresh(role_perm)
            return role_perm

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> bool:
        """Remove permission from role."""
        with self._session() as db:
            role_perm = (
                db.query(RolePermission)
                .filter(
                    and_(
                        RolePermission.role_id == role_id,
                        RolePermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if role_perm:
                db.delete(role_perm)
                db.commit()
                return True
            return False

    def get_role_permissions(self, role_id: int) -> List[Permission]:
        """Get all permissions for a role."""
        with self._session() as db:
            return (
                db.query(Permission)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .filter(RolePermission.role_id == role_id, RolePermission.granted)
                .all()
            )

    # ========================================================================
    # User-Role Operations
    # ========================================================================

    def assign_role_to_user(self, user_id: int, role_id: int) -> UserRole:
        """Assign role to user."""
        with self._session() as db:
            existing = (
                db.query(UserRole)
                .filter(and_(UserRole.user_id == user_id, UserRole.role_id == role_id))
                .first()
            )

            if existing:
                return existing

            user_role = UserRole(user_id=user_id, role_id=role_id)
            db.add(user_role)
            db.commit()
            db.refresh(user_role)
            return user_role

    def remove_role_from_user(self, user_id: int, role_id: int) -> bool:
        """Remove role from user."""
        with self._session() as db:
            user_role = (
                db.query(UserRole)
                .filter(and_(UserRole.user_id == user_id, UserRole.role_id == role_id))
                .first()
            )

            if user_role:
                db.delete(user_role)
                db.commit()
                return True
            return False

    def get_user_roles(self, user_id: int) -> List[Role]:
        """Get all roles for a user."""
        with self._session() as db:
            return (
                db.query(Role)
                .join(UserRole, UserRole.role_id == Role.id)
                .filter(UserRole.user_id == user_id)
                .all()
            )

    def get_users_with_role(self, role_id: int) -> List[int]:
        """Get all user IDs with a specific role."""
        with self._session() as db:
            user_roles = db.query(UserRole).filter(UserRole.role_id == role_id).all()
            return [ur.user_id for ur in user_roles]

    # ========================================================================
    # User-Permission Operations
    # ========================================================================

    def assign_permission_to_user(
        self, user_id: int, permission_id: int, granted: bool = True
    ) -> UserPermission:
        """Assign permission directly to user."""
        with self._session() as db:
            existing = (
                db.query(UserPermission)
                .filter(
                    and_(
                        UserPermission.user_id == user_id,
                        UserPermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if existing:
                existing.granted = granted
                db.commit()
                db.refresh(existing)
                return existing

            user_perm = UserPermission(
                user_id=user_id, permission_id=permission_id, granted=granted
            )
            db.add(user_perm)
            db.commit()
            db.refresh(user_perm)
            return user_perm

    def remove_permission_from_user(self, user_id: int, permission_id: int) -> bool:
        """Remove permission from user."""
        with self._session() as db:
            user_perm = (
                db.query(UserPermission)
                .filter(
                    and_(
                        UserPermission.user_id == user_id,
                        UserPermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if user_perm:
                db.delete(user_perm)
                db.commit()
                return True
            return False

    def get_user_permissions(self, user_id: int) -> List[Permission]:
        """Get all direct permissions for a user."""
        with self._session() as db:
            return (
                db.query(Permission)
                .join(UserPermission, UserPermission.permission_id == Permission.id)
                .filter(UserPermission.user_id == user_id, UserPermission.granted)
                .all()
            )

    def get_user_permission_override(
        self, user_id: int, permission_id: int
    ) -> Optional[bool]:
        """Get user's permission override (True=granted, False=denied, None=no override)."""
        with self._session() as db:
            user_perm = (
                db.query(UserPermission)
                .filter(
                    and_(
                        UserPermission.user_id == user_id,
                        UserPermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            return user_perm.granted if user_perm else None

    def get_user_permission_overrides_with_status(
        self, user_id: int
    ) -> List[tuple[Permission, bool]]:
        """Get all permission overrides for a user with their granted status.

        Returns:
            List of tuples (Permission, granted) for all user permission overrides
        """
        with self._session() as db:
            return (
                db.query(Permission, UserPermission.granted)
                .join(UserPermission, UserPermission.permission_id == Permission.id)
                .filter(UserPermission.user_id == user_id)
                .all()
            )
