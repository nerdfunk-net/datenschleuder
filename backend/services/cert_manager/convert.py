"""PEM ↔ PKCS12 conversion for cert-manager."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status

from services.cert_manager._openssl import _run_openssl_check
from services.cert_manager.file_service import (
    get_repository_for_instance,
    resolve_cert_file_path,
)
from services.cert_manager.git_integration import _commit_file
from services.settings.git.paths import repo_path


def convert_cert_file(
    instance_id: int,
    file_path: str,
    target_format: str,
    output_filename: str,
    password: Optional[str] = None,
) -> dict:
    """Convert a certificate file between PEM and PKCS12 formats.

    Args:
        instance_id: NiFi instance ID.
        file_path: Relative path to source file within the repo.
        target_format: "pem" or "p12".
        output_filename: Filename for the converted output (relative to repo root).
        password: Password for P12 files (source or target).

    Returns:
        dict with success, message, output_path, commit_sha.
    """
    src_abs = resolve_cert_file_path(instance_id, file_path)
    repository = get_repository_for_instance(instance_id)
    root = repo_path(repository)
    out_abs = (root / output_filename).resolve()

    # Safety: ensure output is within repo
    try:
        out_abs.relative_to(root.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Output filename must be within the repository.",
        ) from exc

    out_abs.parent.mkdir(parents=True, exist_ok=True)
    src_suffix = src_abs.suffix.lower()

    if target_format == "pem" and src_suffix == ".p12":
        # P12 → PEM
        cmd = ["pkcs12", "-in", str(src_abs), "-nokeys", "-out", str(out_abs), "-nodes"]
        if password:
            cmd += ["-passin", f"pass:{password}"]
        else:
            cmd += ["-passin", "pass:"]
        result = _run_openssl_check(*cmd)
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Conversion failed: {result.stderr.decode(errors='replace')}",
            )

    elif target_format == "p12" and src_suffix == ".pem":
        # PEM → P12
        cmd = ["pkcs12", "-export", "-in", str(src_abs), "-out", str(out_abs), "-nokeys"]
        if password:
            cmd += ["-passout", f"pass:{password}"]
        else:
            cmd += ["-passout", "pass:"]
        result = _run_openssl_check(*cmd)
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Conversion failed: {result.stderr.decode(errors='replace')}",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot convert from '{src_suffix}' to '{target_format}'.",
        )

    commit_sha = _commit_file(repository, out_abs, f"convert {src_abs.name} to {target_format}")
    return {
        "success": True,
        "message": f"Converted '{src_abs.name}' to '{target_format}' as '{output_filename}'.",
        "output_path": str(out_abs.relative_to(root)),
        "commit_sha": commit_sha,
    }
