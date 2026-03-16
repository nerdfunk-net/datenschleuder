"""Certificate import for cert-manager."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status

from services.cert_manager.file_service import (
    get_repository_for_instance,
)
from services.cert_manager.git_integration import _commit_file
from services.settings.git.paths import repo_path


def import_certificate(
    instance_id: int,
    target_file_path: str,
    cert_bytes: bytes,
    cert_filename: str,
    password: Optional[str] = None,  # noqa: ARG001 — reserved for future encrypted import
) -> dict:
    """Import a certificate file into the git repository.

    The uploaded cert is saved to the target path (appended if PEM, replaced if P12).

    Args:
        instance_id: NiFi instance ID.
        target_file_path: Relative path in repo to write/append to.
        cert_bytes: Raw bytes of the certificate file to import.
        cert_filename: Original filename (used to detect format).
        password: Password for P12 files.

    Returns:
        dict with success, message, output_path, commit_sha.
    """
    repository = get_repository_for_instance(instance_id)
    root = repo_path(repository)
    out_abs = (root / target_file_path).resolve()

    try:
        out_abs.relative_to(root.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target file path must be within the repository.",
        ) from exc

    out_abs.parent.mkdir(parents=True, exist_ok=True)

    src_suffix = Path(cert_filename).suffix.lower()
    target_suffix = out_abs.suffix.lower()

    if target_suffix == ".pem" and src_suffix in (".pem", ".crt", ".cer"):
        # Append PEM cert to existing truststore
        out_abs.write_bytes(
            out_abs.read_bytes() + b"\n" + cert_bytes
            if out_abs.exists()
            else cert_bytes
        )
    elif target_suffix == ".p12" or src_suffix == ".p12":
        # Replace P12 entirely
        out_abs.write_bytes(cert_bytes)
    else:
        # Fallback: write as-is
        out_abs.write_bytes(cert_bytes)

    commit_sha = _commit_file(repository, out_abs, f"import {cert_filename}")
    return {
        "success": True,
        "message": f"Imported '{cert_filename}' into '{target_file_path}'.",
        "output_path": str(out_abs.relative_to(root)),
        "commit_sha": commit_sha,
    }
