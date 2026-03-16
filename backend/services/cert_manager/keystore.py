"""Keystore and truststore creation for cert-manager."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status

from services.cert_manager._openssl import _run_openssl_check
from services.cert_manager.file_service import get_repository_for_instance
from services.cert_manager.git_integration import _commit_file
from services.settings.git.paths import repo_path


def create_new_keystore(
    instance_id: int,
    filename: str,
    password: str,
    subject_cn: str,
    subject_ou: Optional[str] = None,
    subject_o: Optional[str] = None,
    subject_c: Optional[str] = None,
    validity_days: int = 365,
    key_size: int = 2048,
) -> dict:
    """Generate a new PKCS12 keystore with a self-signed certificate.

    Args:
        instance_id: NiFi instance ID.
        filename: Output filename (relative to repo root).
        password: Password for the keystore.
        subject_cn: Common Name for the certificate subject.
        subject_ou: Organizational Unit (optional).
        subject_o: Organization (optional).
        subject_c: Country code (optional).
        validity_days: Certificate validity in days.
        key_size: RSA key size in bits.

    Returns:
        dict with success, message, output_path, commit_sha.
    """
    repository = get_repository_for_instance(instance_id)
    root = repo_path(repository)
    out_abs = (root / filename).resolve()

    try:
        out_abs.relative_to(root.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must be within the repository.",
        ) from exc

    out_abs.parent.mkdir(parents=True, exist_ok=True)

    # Build subject DN
    subject_parts = [f"CN={subject_cn}"]
    if subject_ou:
        subject_parts.append(f"OU={subject_ou}")
    if subject_o:
        subject_parts.append(f"O={subject_o}")
    if subject_c:
        subject_parts.append(f"C={subject_c}")
    subject_dn = "/" + "/".join(subject_parts)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        tmp_key = tmp_path / "key.pem"
        tmp_cert = tmp_path / "cert.pem"

        # Generate RSA key
        result = _run_openssl_check("genrsa", "-out", str(tmp_key), str(key_size))
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Key generation failed: {result.stderr.decode(errors='replace')}",
            )

        # Generate self-signed certificate
        result = _run_openssl_check(
            "req",
            "-new",
            "-x509",
            "-key",
            str(tmp_key),
            "-out",
            str(tmp_cert),
            "-days",
            str(validity_days),
            "-subj",
            subject_dn,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Certificate generation failed: {result.stderr.decode(errors='replace')}",
            )

        # Package as PKCS12
        result = _run_openssl_check(
            "pkcs12",
            "-export",
            "-in",
            str(tmp_cert),
            "-inkey",
            str(tmp_key),
            "-out",
            str(out_abs),
            "-passout",
            f"pass:{password}",
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Keystore creation failed: {result.stderr.decode(errors='replace')}",
            )

    commit_sha = _commit_file(repository, out_abs, f"create keystore {filename}")
    return {
        "success": True,
        "message": f"Created keystore '{filename}' with CN={subject_cn}.",
        "output_path": str(out_abs.relative_to(root)),
        "commit_sha": commit_sha,
    }


def create_new_truststore(
    instance_id: int,
    filename: str,
    subject_cn: str,
    subject_ou: Optional[str] = None,
    subject_o: Optional[str] = None,
    subject_c: Optional[str] = None,
    validity_days: int = 365,
) -> dict:
    """Generate a new PEM truststore containing a self-signed certificate.

    Args:
        instance_id: NiFi instance ID.
        filename: Output filename (relative to repo root), should end in .pem.
        subject_cn: Common Name for the self-signed certificate.
        subject_ou: Organizational Unit (optional).
        subject_o: Organization (optional).
        subject_c: Country code (optional).
        validity_days: Certificate validity in days.

    Returns:
        dict with success, message, output_path, commit_sha.
    """
    repository = get_repository_for_instance(instance_id)
    root = repo_path(repository)
    out_abs = (root / filename).resolve()

    try:
        out_abs.relative_to(root.resolve())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must be within the repository.",
        ) from exc

    out_abs.parent.mkdir(parents=True, exist_ok=True)

    subject_parts = [f"CN={subject_cn}"]
    if subject_ou:
        subject_parts.append(f"OU={subject_ou}")
    if subject_o:
        subject_parts.append(f"O={subject_o}")
    if subject_c:
        subject_parts.append(f"C={subject_c}")
    subject_dn = "/" + "/".join(subject_parts)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        tmp_key = tmp_path / "key.pem"

        # Generate temporary key (not stored)
        result = _run_openssl_check("genrsa", "-out", str(tmp_key), "2048")
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Key generation failed: {result.stderr.decode(errors='replace')}",
            )

        # Generate self-signed certificate directly to output path
        result = _run_openssl_check(
            "req",
            "-new",
            "-x509",
            "-key",
            str(tmp_key),
            "-out",
            str(out_abs),
            "-days",
            str(validity_days),
            "-subj",
            subject_dn,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Truststore creation failed: {result.stderr.decode(errors='replace')}",
            )

    commit_sha = _commit_file(repository, out_abs, f"create truststore {filename}")
    return {
        "success": True,
        "message": f"Created truststore '{filename}' with CN={subject_cn}.",
        "output_path": str(out_abs.relative_to(root)),
        "commit_sha": commit_sha,
    }
