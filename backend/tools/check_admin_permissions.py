"""Check admin user permissions - debugging script."""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import rbac_manager as rbac
import user_db_manager as user_db


def main():
    print("\n" + "=" * 60)
    print("ADMIN USER PERMISSION CHECK")
    print("=" * 60 + "\n")

    # Get admin user
    admin_user = user_db.get_user_by_username("admin")
    if not admin_user:
        print("❌ Admin user not found!")
        return

    print(f"✓ Found admin user (ID: {admin_user['id']})")
    print(f"  Username: {admin_user['username']}")
    print(f"  Real name: {admin_user['realname']}")
    print()

    # Get admin roles
    roles = rbac.get_user_roles(admin_user["id"])
    if roles:
        print(f"✓ Admin has {len(roles)} role(s):")
        for role in roles:
            print(f"  - {role['name']}")
    else:
        print("❌ Admin has no roles assigned!")
    print()

    # Get admin permissions
    permissions = rbac.get_user_permissions(admin_user["id"])
    print(f"✓ Admin has {len(permissions)} effective permission(s)")
    print()

    # Check for dashboard.settings:read specifically
    dashboard_settings_perm = next(
        (
            p
            for p in permissions
            if p["resource"] == "dashboard.settings" and p["action"] == "read"
        ),
        None,
    )

    if dashboard_settings_perm:
        print("✅ dashboard.settings:read permission FOUND")
        print(f"   Source: {dashboard_settings_perm.get('source', 'unknown')}")
        print(f"   Granted: {dashboard_settings_perm.get('granted', False)}")
    else:
        print("❌ dashboard.settings:read permission NOT FOUND")
        print("\n   This permission is required to see the Settings menu.")
        print("   Run: PYTHONPATH=. python tools/seed_rbac.py")
        print("   Then log out and log back in to refresh your session.")

    print()
    print("All permissions:")
    print("-" * 60)
    for perm in permissions:
        granted = "✓" if perm.get("granted") else "✗"
        source = perm.get("source", "?")
        print(f"  {granted} {perm['resource']}:{perm['action']} ({source})")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
