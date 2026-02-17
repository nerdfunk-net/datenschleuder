"""Seed script for RBAC system.

This script initializes the RBAC system with:
- Default permissions for all scaffold resources
- System roles (admin, operator, network_engineer, viewer)
- Permission assignments to roles
"""

import argparse
import sys
import rbac_manager as rbac
import user_db_manager as user_db


def remove_all_rbac_data(verbose: bool = True):
    """Remove all existing RBAC entries from the database.

    This function removes all RBAC data in the correct order to respect
    foreign key constraints:
    1. User-permission overrides
    2. User-role assignments
    3. Role-permission assignments
    4. Roles
    5. Permissions

    Args:
        verbose: If True, print progress messages
    """
    if verbose:
        print("\n" + "=" * 60)
        print("⚠️  REMOVING ALL EXISTING RBAC DATA")
        print("=" * 60 + "\n")

    # Step 1: Remove all user-permission overrides
    if verbose:
        print("Step 1: Removing user-permission overrides...")

    # Get all users and remove their permission overrides
    try:
        import user_db_manager

        all_users = user_db_manager.get_all_users(include_inactive=True)
        override_count = 0

        for user in all_users:
            user_id = user["id"]
            overrides = rbac.get_user_permission_overrides(user_id)
            for override in overrides:
                rbac.remove_permission_from_user(user_id, override["id"])
                override_count += 1

        if verbose:
            print(f"  ✓ Removed {override_count} user-permission overrides\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error removing user-permission overrides: {e}\n")

    # Step 2: Remove all user-role assignments
    if verbose:
        print("Step 2: Removing user-role assignments...")

    try:
        assignment_count = 0
        for user in all_users:
            user_id = user["id"]
            user_roles = rbac.get_user_roles(user_id)
            for role in user_roles:
                rbac.remove_role_from_user(user_id, role["id"])
                assignment_count += 1

        if verbose:
            print(f"  ✓ Removed {assignment_count} user-role assignments\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error removing user-role assignments: {e}\n")

    # Step 3: Remove all role-permission assignments
    if verbose:
        print("Step 3: Removing role-permission assignments...")

    try:
        all_roles = rbac.list_roles()
        role_perm_count = 0

        for role in all_roles:
            role_permissions = rbac.get_role_permissions(role["id"])
            for perm in role_permissions:
                rbac.remove_permission_from_role(role["id"], perm["id"])
                role_perm_count += 1

        if verbose:
            print(f"  ✓ Removed {role_perm_count} role-permission assignments\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error removing role-permission assignments: {e}\n")

    # Step 4: Delete all roles
    if verbose:
        print("Step 4: Deleting all roles...")

    try:
        all_roles = rbac.list_roles()
        deleted_roles = 0

        for role in all_roles:
            try:
                # Try to delete the role (will work for non-system roles)
                rbac.delete_role(role["id"])
                deleted_roles += 1
                if verbose:
                    print(f"  ✓ Deleted role: {role['name']}")
            except ValueError as e:
                # System roles can't be deleted normally, use repository directly
                if "Cannot delete system role" in str(e):
                    from repositories.auth.rbac_repository import RBACRepository

                    repo = RBACRepository()
                    if repo.delete_role(role["id"]):
                        deleted_roles += 1
                        if verbose:
                            print(f"  ✓ Deleted system role: {role['name']}")
                else:
                    if verbose:
                        print(f"  ✗ Error deleting role {role['name']}: {e}")

        if verbose:
            print(f"\n  ✓ Deleted {deleted_roles} roles\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error deleting roles: {e}\n")

    # Step 5: Delete all permissions
    if verbose:
        print("Step 5: Deleting all permissions...")

    try:
        all_permissions = rbac.list_permissions()
        deleted_perms = 0

        for perm in all_permissions:
            try:
                rbac.delete_permission(perm["id"])
                deleted_perms += 1
                if verbose:
                    print(
                        f"  ✓ Deleted permission: {perm['resource']}:{perm['action']}"
                    )
            except Exception as e:
                if verbose:
                    print(
                        f"  ✗ Error deleting permission {perm['resource']}:{perm['action']}: {e}"
                    )

        if verbose:
            print(f"\n  ✓ Deleted {deleted_perms} permissions\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error deleting permissions: {e}\n")

    if verbose:
        print("=" * 60)
        print("✅ All RBAC data removed successfully!")
        print("=" * 60 + "\n")


def seed_permissions(verbose: bool = True):
    """Create all default permissions."""
    if verbose:
        print("Creating permissions...")

    permissions = [
        # Dashboard permissions
        ("dashboard.settings", "read", "Access to Settings menu and pages"),
        # Git permissions
        ("git.repositories", "read", "View git repositories"),
        ("git.repositories", "write", "Create/modify git repositories"),
        ("git.repositories", "delete", "Delete git repositories"),
        ("git.operations", "execute", "Execute git operations (commit, push, pull)"),
        # Settings permissions
        ("settings.git", "read", "View Git settings"),
        ("settings.git", "write", "Modify Git settings"),
        ("settings.cache", "read", "View cache settings"),
        ("settings.cache", "write", "Modify cache settings and manage cache"),
        ("settings.celery", "read", "View Celery task queue status"),
        ("settings.celery", "write", "Manage Celery tasks and workers"),
        ("settings.credentials", "read", "View credentials"),
        ("settings.credentials", "write", "Create/modify credentials"),
        ("settings.credentials", "delete", "Delete credentials"),
        ("settings.common", "read", "View common settings"),
        ("settings.common", "write", "Modify common settings"),
        # User management permissions
        ("users", "read", "View users"),
        ("users", "write", "Create/modify users"),
        ("users", "delete", "Delete users"),
        ("users.roles", "write", "Assign roles to users"),
        ("users.permissions", "write", "Assign permissions to users"),
        # RBAC management permissions
        ("rbac.roles", "read", "View roles"),
        ("rbac.roles", "write", "Create/modify roles"),
        ("rbac.roles", "delete", "Delete roles"),
        ("rbac.permissions", "read", "View all permissions"),
        # Jobs permissions
        ("jobs.templates", "read", "View job templates"),
        ("jobs.templates", "write", "Create/modify job templates"),
        ("jobs.templates", "delete", "Delete job templates"),
        ("jobs.schedules", "read", "View job schedules"),
        ("jobs.schedules", "write", "Create/modify job schedules"),
        ("jobs.schedules", "delete", "Delete job schedules"),
        ("jobs.runs", "read", "View job execution history"),
        ("jobs.runs", "execute", "Execute jobs manually"),
    ]

    created_count = 0
    for resource, action, description in permissions:
        try:
            rbac.create_permission(resource, action, description)
            created_count += 1
            if verbose:
                print(f"  ✓ Created permission: {resource}:{action}")
        except ValueError as e:
            if verbose:
                print(f"  - Skipped: {e}")

    if verbose:
        print(f"\nCreated {created_count} permissions\n")


def seed_roles(verbose: bool = True):
    """Create default system roles."""
    if verbose:
        print("Creating roles...")

    roles = [
        ("admin", "Full system administrator with all permissions", True),
        (
            "operator",
            "Can manage devices and configurations but not system settings",
            True,
        ),
        (
            "network_engineer",
            "Full access to network tools, read-only for settings",
            True,
        ),
        ("viewer", "Read-only access to all resources", True),
    ]

    role_objects = {}
    for name, description, is_system in roles:
        try:
            role = rbac.create_role(name, description, is_system)
            role_objects[name] = role
            if verbose:
                print(f"  ✓ Created role: {name}")
        except ValueError as e:
            if verbose:
                print(f"  - Skipped: {e}")
            role = rbac.get_role_by_name(name)
            role_objects[name] = role

    if verbose:
        print(f"\nCreated {len(role_objects)} roles\n")
    return role_objects


def assign_permissions_to_roles(roles, verbose: bool = True):
    """Assign permissions to roles."""
    if verbose:
        print("Assigning permissions to roles...")

    # Get all permissions
    all_permissions = rbac.list_permissions()
    perm_map = {f"{p['resource']}:{p['action']}": p["id"] for p in all_permissions}

    # Admin: Full access to everything
    if verbose:
        print("\n  Assigning permissions to 'admin' role...")
    admin_count = 0
    for perm_id in perm_map.values():
        rbac.assign_permission_to_role(roles["admin"]["id"], perm_id, granted=True)
        admin_count += 1
    if verbose:
        print(f"    ✓ Assigned {admin_count} permissions")

    # Operator: Manage jobs and templates, read settings
    if verbose:
        print("\n  Assigning permissions to 'operator' role...")
    operator_perms = [
        # Dashboard
        "dashboard.settings:read",
        # Git
        "git.repositories:read",
        "git.operations:execute",
        # Settings (read-only)
        "settings.git:read",
        "settings.cache:read",
        "settings.celery:read",
        "settings.credentials:read",
        "settings.common:read",
        # Jobs (full access)
        "jobs.templates:read",
        "jobs.templates:write",
        "jobs.templates:delete",
        "jobs.schedules:read",
        "jobs.schedules:write",
        "jobs.schedules:delete",
        "jobs.runs:read",
        "jobs.runs:execute",
    ]
    operator_count = 0
    for perm_key in operator_perms:
        if perm_key in perm_map:
            rbac.assign_permission_to_role(
                roles["operator"]["id"], perm_map[perm_key], granted=True
            )
            operator_count += 1
    if verbose:
        print(f"    ✓ Assigned {operator_count} permissions")

    # Network Engineer: Same as operator for scaffold (can be customized later)
    if verbose:
        print("\n  Assigning permissions to 'network_engineer' role...")
    network_perms = operator_perms.copy()
    network_count = 0
    for perm_key in network_perms:
        if perm_key in perm_map:
            rbac.assign_permission_to_role(
                roles["network_engineer"]["id"], perm_map[perm_key], granted=True
            )
            network_count += 1
    if verbose:
        print(f"    ✓ Assigned {network_count} permissions")

    # Viewer: Read-only access to everything except sensitive settings
    if verbose:
        print("\n  Assigning permissions to 'viewer' role...")
    viewer_perms = [
        # Dashboard
        "dashboard.settings:read",
        # Git
        "git.repositories:read",
        # Settings (read-only, excluding credentials)
        "settings.git:read",
        "settings.cache:read",
        "settings.celery:read",
        # Jobs (read-only)
        "jobs.templates:read",
        "jobs.schedules:read",
        "jobs.runs:read",
        # RBAC (read-only)
        "rbac.roles:read",
        "rbac.permissions:read",
    ]
    viewer_count = 0
    for perm_key in viewer_perms:
        if perm_key in perm_map:
            rbac.assign_permission_to_role(
                roles["viewer"]["id"], perm_map[perm_key], granted=True
            )
            viewer_count += 1
    if verbose:
        print(f"    ✓ Assigned {viewer_count} permissions")

    if verbose:
        print("\n✅ Permission assignment complete\n")


def assign_admin_user_to_admin_role(verbose: bool = True):
    """Assign the 'admin' user to the 'admin' role."""
    if verbose:
        print("Assigning admin user to admin role...")

    try:
        # Get admin user
        admin_user = user_db.get_user_by_username("admin")
        if not admin_user:
            if verbose:
                print("  ⚠️  Admin user not found, skipping role assignment")
            return

        # Get admin role
        admin_role = rbac.get_role_by_name("admin")
        if not admin_role:
            if verbose:
                print("  ⚠️  Admin role not found, skipping role assignment")
            return

        # Check if assignment already exists
        existing_roles = rbac.get_user_roles(admin_user["id"])
        if any(role["id"] == admin_role["id"] for role in existing_roles):
            if verbose:
                print("  - Admin user already has admin role")
            return

        # Assign admin role to admin user
        rbac.assign_role_to_user(admin_user["id"], admin_role["id"])
        if verbose:
            print(
                f"  ✓ Assigned 'admin' role to user 'admin' (user_id={admin_user['id']})"
            )

    except Exception as e:
        if verbose:
            print(f"  ⚠️  Error assigning admin role: {e}")


def main(verbose: bool = True, remove_existing: bool = False):
    """Run the seeding process.

    Args:
        verbose: If True, print progress messages. If False, run silently.
        remove_existing: If True, remove all existing RBAC data before seeding.
    """
    if verbose:
        print("\n" + "=" * 60)
        print("RBAC System Initialization")
        print("=" * 60 + "\n")

    # Remove existing RBAC data if requested
    if remove_existing:
        remove_all_rbac_data(verbose=verbose)

    # Create permissions
    seed_permissions(verbose=verbose)

    # Create roles
    roles = seed_roles(verbose=verbose)

    # Assign permissions to roles
    assign_permissions_to_roles(roles, verbose=verbose)

    # Assign admin user to admin role
    assign_admin_user_to_admin_role(verbose=verbose)

    if verbose:
        print("=" * 60)
        print("✅ RBAC system seeded successfully!")
        print("=" * 60 + "\n")

        # Print summary
        print("Summary:")
        print(f"  - Permissions: {len(rbac.list_permissions())}")
        print(f"  - Roles: {len(rbac.list_roles())}")
        print("\nAvailable roles:")
        for role in rbac.list_roles():
            perms = rbac.get_role_permissions(role["id"])
            print(f"  - {role['name']}: {len(perms)} permissions")
        print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed the RBAC system with default permissions and roles"
    )
    parser.add_argument(
        "--remove-existing-permissions",
        action="store_true",
        help="Remove all existing RBAC data before seeding (WARNING: This will remove all roles, permissions, and assignments)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Run silently without progress messages",
    )

    args = parser.parse_args()

    # Confirm removal if requested
    if args.remove_existing_permissions:
        print("\n⚠️  WARNING: This will remove ALL existing RBAC data including:")
        print("   - All user-role assignments")
        print("   - All user-permission overrides")
        print("   - All roles (including system roles)")
        print("   - All permissions")
        print("\n   The system will then be reseeded with default data.")
        print("\n   Users will need to be reassigned to roles after this operation.\n")

        response = (
            input("Are you sure you want to continue? (yes/no): ").strip().lower()
        )
        if response != "yes":
            print("\n❌ Operation cancelled.")
            sys.exit(0)

    main(verbose=not args.quiet, remove_existing=args.remove_existing_permissions)
