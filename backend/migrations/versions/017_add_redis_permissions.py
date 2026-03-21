"""
Migration 017: Add settings.redis permissions and grant them to the admin role.

Inserts settings.redis:read and settings.redis:write into the permissions table
(if they don't already exist) and grants both to the admin role so that existing
installations don't require a full RBAC re-seed.
"""

from sqlalchemy import text
from migrations.base import BaseMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "017_add_redis_permissions"

    @property
    def description(self) -> str:
        return "Add settings.redis read/write permissions and grant them to admin role"

    def upgrade(self) -> dict:
        stats = {"permissions_added": 0, "grants_added": 0}

        new_permissions = [
            ("settings.redis", "read", "View Redis server configurations"),
            ("settings.redis", "write", "Create/modify/delete Redis server configurations"),
        ]

        with self.engine.connect() as conn:
            # --- 1. Insert permissions if they don't exist ---
            for resource, action, description in new_permissions:
                existing = conn.execute(
                    text(
                        "SELECT id FROM permissions WHERE resource = :r AND action = :a"
                    ),
                    {"r": resource, "a": action},
                ).fetchone()

                if existing is None:
                    conn.execute(
                        text(
                            "INSERT INTO permissions (resource, action, description) "
                            "VALUES (:r, :a, :d)"
                        ),
                        {"r": resource, "a": action, "d": description},
                    )
                    conn.commit()
                    stats["permissions_added"] += 1
                    self.log_info(f"Added permission: {resource}:{action}")
                else:
                    self.log_info(f"Permission already exists: {resource}:{action}")

            # --- 2. Grant both permissions to the admin role ---
            admin_role = conn.execute(
                text("SELECT id FROM roles WHERE name = 'admin'")
            ).fetchone()

            if admin_role is None:
                self.log_info("Admin role not found — skipping role grants")
                return stats

            admin_role_id = admin_role[0]

            for resource, action, _ in new_permissions:
                perm = conn.execute(
                    text(
                        "SELECT id FROM permissions WHERE resource = :r AND action = :a"
                    ),
                    {"r": resource, "a": action},
                ).fetchone()

                if perm is None:
                    continue

                perm_id = perm[0]

                already_granted = conn.execute(
                    text(
                        "SELECT 1 FROM role_permissions "
                        "WHERE role_id = :rid AND permission_id = :pid"
                    ),
                    {"rid": admin_role_id, "pid": perm_id},
                ).fetchone()

                if already_granted is None:
                    conn.execute(
                        text(
                            "INSERT INTO role_permissions (role_id, permission_id, granted) "
                            "VALUES (:rid, :pid, TRUE)"
                        ),
                        {"rid": admin_role_id, "pid": perm_id},
                    )
                    conn.commit()
                    stats["grants_added"] += 1
                    self.log_info(
                        f"Granted {resource}:{action} to admin role"
                    )
                else:
                    self.log_info(
                        f"Admin already has {resource}:{action}, skipping"
                    )

        return stats
