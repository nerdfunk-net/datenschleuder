from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from pathlib import Path
import yaml
from core.auth import verify_admin_token
from core.schema_manager import SchemaManager
from dependencies import get_certificate_manager
import logging

logger = logging.getLogger(__name__)

# Path to the NiPyAPI certs directory (project_root/config/nipyapi/)
_CERTS_DIR = Path(__file__).parent.parent.parent / "config" / "nipyapi"
_CERTS_CONFIG = _CERTS_DIR / "certificates.yaml"


class CertificateEntry(BaseModel):
    name: str
    ca_cert_content: Optional[str] = None
    cert_content: Optional[str] = None
    key_content: Optional[str] = None
    password: str = ""


def _load_cert_config() -> List[Dict]:
    if not _CERTS_CONFIG.exists():
        return []
    with open(_CERTS_CONFIG, "r") as f:
        data = yaml.safe_load(f) or {}
    return data.get("certificates", [])


def _save_cert_config(certificates: List[Dict]) -> None:
    _CERTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(_CERTS_CONFIG, "w") as f:
        yaml.safe_dump({"certificates": certificates}, f, default_flow_style=False)

router = APIRouter(
    prefix="/api/tools",
    tags=["tools"],
    responses={404: {"description": "Not found"}},
)


@router.get("/schema/status", dependencies=[Depends(verify_admin_token)])
async def get_schema_status() -> Dict[str, Any]:
    """
    Get the status of the database schema compared to the defined models.
    Also includes information about the versioned migration system.
    """
    manager = SchemaManager()
    return manager.get_schema_status()


@router.get("/schema/migrations", dependencies=[Depends(verify_admin_token)])
async def get_applied_migrations() -> Dict[str, Any]:
    """
    Get list of all applied versioned migrations from the migration system.
    Returns empty list if migration system hasn't been initialized.
    """
    manager = SchemaManager()
    migrations = manager.get_applied_migrations()
    return {
        "migrations": migrations,
        "count": len(migrations),
    }


@router.post("/schema/migrate", dependencies=[Depends(verify_admin_token)])
async def migrate_schema() -> Dict[str, Any]:
    """
    Perform database migration to match the defined models.
    Only adds missing tables and columns.

    WARNING: This is for emergency use only. For production, prefer creating
    versioned migrations in backend/migrations/versions/
    """
    manager = SchemaManager()
    return manager.perform_migration()


@router.post("/rbac/seed", dependencies=[Depends(verify_admin_token)])
async def seed_rbac(remove_existing: bool = False) -> Dict[str, Any]:
    """
    Seed the RBAC system with default permissions and roles.
    This should be run after database migrations that add new tables.

    Args:
        remove_existing: If True, remove all existing RBAC data before seeding.
                        WARNING: This removes all roles, permissions, and assignments!
    """
    try:
        from tools import seed_rbac
        from io import StringIO
        import sys

        # Capture stdout to return to frontend
        captured_output = StringIO()
        old_stdout = sys.stdout
        sys.stdout = captured_output

        try:
            # Run the seed script with verbose output
            seed_rbac.main(verbose=True, remove_existing=remove_existing)

            # Get the captured output
            output = captured_output.getvalue()

            return {
                "success": True,
                "message": "RBAC system seeded successfully"
                if not remove_existing
                else "RBAC system cleaned and reseeded successfully",
                "output": output,
            }
        finally:
            # Restore stdout
            sys.stdout = old_stdout

    except Exception as e:
        logger.error("Error seeding RBAC: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to seed RBAC system: {str(e)}"
        )


# ---------------------------------------------------------------------------
# Certificate management
# ---------------------------------------------------------------------------


@router.get("/certificates", dependencies=[Depends(verify_admin_token)])
async def list_certificates() -> Dict[str, Any]:
    """
    List all client certificates registered in certs/certificates.yaml,
    with the filesystem existence status of each associated PEM file.
    """
    try:
        entries = _load_cert_config()
        result = []
        for entry in entries:
            name = entry.get("name", "")
            files_status = {}
            for field in ("ca_cert_file", "cert_file", "key_file"):
                filename = entry.get(field, "")
                if filename:
                    files_status[field] = {
                        "filename": filename,
                        "exists": (_CERTS_DIR / filename).exists(),
                    }
                else:
                    files_status[field] = {"filename": "", "exists": False}

            result.append(
                {
                    "name": name,
                    "password_set": bool(entry.get("password")),
                    "files": files_status,
                }
            )

        return {
            "certificates": result,
            "certs_dir": str(_CERTS_DIR),
            "config_file": str(_CERTS_CONFIG),
            "config_exists": _CERTS_CONFIG.exists(),
        }
    except Exception as e:
        logger.error("Error listing certificates: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list certificates: {str(e)}")


@router.post("/certificates", dependencies=[Depends(verify_admin_token)])
async def add_certificate(entry: CertificateEntry, cert_mgr=Depends(get_certificate_manager)) -> Dict[str, Any]:
    """
    Add a new certificate to certs/certificates.yaml.
    PEM content for ca_cert, cert, and key is written to individual files
    named after the entry (e.g. myname_ca.pem, myname_cert.pem, myname_key.pem).
    """
    try:
        entries = _load_cert_config()

        # Ensure name is unique
        if any(e.get("name") == entry.name for e in entries):
            raise HTTPException(
                status_code=409,
                detail=f"A certificate with name '{entry.name}' already exists.",
            )

        _CERTS_DIR.mkdir(parents=True, exist_ok=True)

        safe_name = entry.name.replace(" ", "_").replace("/", "_")
        ca_filename = f"{safe_name}_ca.pem"
        cert_filename = f"{safe_name}_cert.pem"
        key_filename = f"{safe_name}_key.pem"

        # Write PEM files that were provided
        if entry.ca_cert_content:
            (_CERTS_DIR / ca_filename).write_text(entry.ca_cert_content.strip() + "\n")
        if entry.cert_content:
            (_CERTS_DIR / cert_filename).write_text(entry.cert_content.strip() + "\n")
        if entry.key_content:
            (_CERTS_DIR / key_filename).write_text(entry.key_content.strip() + "\n")

        new_entry: Dict = {
            "name": entry.name,
            "ca_cert_file": ca_filename,
            "cert_file": cert_filename,
            "key_file": key_filename,
            "password": entry.password,
        }
        entries.append(new_entry)
        _save_cert_config(entries)

        # Reload in-memory cache
        cert_mgr.reload()

        logger.info("Certificate '%s' added successfully", entry.name)
        return {"success": True, "message": f"Certificate '{entry.name}' added.", "entry": new_entry}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error adding certificate '%s': %s", entry.name, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add certificate: {str(e)}")


@router.delete("/certificates/{name}", dependencies=[Depends(verify_admin_token)])
async def delete_certificate(name: str, delete_files: bool = False, cert_mgr=Depends(get_certificate_manager)) -> Dict[str, Any]:
    """
    Remove a certificate entry from certs/certificates.yaml.
    Optionally deletes the associated PEM files from disk.
    """
    try:
        entries = _load_cert_config()
        target = next((e for e in entries if e.get("name") == name), None)

        if target is None:
            raise HTTPException(
                status_code=404, detail=f"Certificate '{name}' not found."
            )

        entries = [e for e in entries if e.get("name") != name]
        _save_cert_config(entries)

        deleted_files: List[str] = []
        if delete_files:
            for field in ("ca_cert_file", "cert_file", "key_file"):
                filename = target.get(field, "")
                if filename:
                    path = _CERTS_DIR / filename
                    if path.exists():
                        path.unlink()
                        deleted_files.append(filename)

        # Reload in-memory cache
        cert_mgr.reload()

        logger.info("Certificate '%s' removed (files deleted: %s)", name, deleted_files)
        return {
            "success": True,
            "message": f"Certificate '{name}' removed.",
            "deleted_files": deleted_files,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting certificate '%s': %s", name, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete certificate: {str(e)}")




