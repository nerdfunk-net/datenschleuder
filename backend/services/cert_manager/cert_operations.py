"""
Certificate operations service.

Handles convert, export, import, and creation of keystores/truststores.
Output files are written to the git repo and committed automatically.
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, status

from services.settings.git.paths import repo_path
from services.settings.git.service import git_service
from services.cert_manager.file_service import (
    resolve_cert_file_path,
    get_repository_for_instance,
)

logger = logging.getLogger(__name__)


def _run_openssl_check(*args: str) -> subprocess.CompletedProcess:
    """Run openssl and raise HTTPException on failure."""
    try:
        result = subprocess.run(
            ["openssl", *args],
            capture_output=True,
            timeout=60,
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="openssl binary not found on the server.",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="openssl operation timed out.",
        ) from exc


def _commit_file(repository: dict, abs_path: Path, operation: str) -> Optional[str]:
    """Stage and commit a single file to the git repository.

    Returns the commit SHA on success, or None if nothing to commit.
    """
    root = repo_path(repository)
    relative = abs_path.relative_to(root)
    commit_msg = f"cert-manager: {operation} → {relative}"

    try:
        result = git_service.commit_and_push(
            repository,
            message=commit_msg,
            files=[str(relative)],
        )
        return result.commit_sha if result.success else None
    except Exception as exc:
        logger.warning("Git commit failed for %s: %s", relative, exc)
        return None


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


def export_certificates(
    instance_id: int,
    file_path: str,
    cert_indices: List[int],
    fmt: str,
    password: Optional[str] = None,
) -> bytes:
    """Export selected certificates from a file.

    Args:
        instance_id: NiFi instance ID.
        file_path: Relative path to the source cert file.
        cert_indices: Indices of certs to export (0-based).
        fmt: Output format "pem", "der", or "p12".
        password: Optional password for encrypted sources/p12 output.

    Returns:
        Raw bytes of the exported file.
    """
    src_abs = resolve_cert_file_path(instance_id, file_path)
    src_suffix = src_abs.suffix.lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        # Extract individual PEM certs first
        if src_suffix == ".pem":
            pem_data = src_abs.read_text()
            marker = "-----BEGIN CERTIFICATE-----"
            end_marker = "-----END CERTIFICATE-----"
            blocks = []
            start = 0
            while True:
                begin = pem_data.find(marker, start)
                if begin == -1:
                    break
                end = pem_data.find(end_marker, begin)
                if end == -1:
                    break
                end += len(end_marker)
                blocks.append(pem_data[begin:end])
                start = end
            selected = [blocks[i] for i in cert_indices if i < len(blocks)]

        elif src_suffix == ".p12":
            # Convert all certs from P12 to temp PEM first
            tmp_pem = tmp_path / "all.pem"
            cmd = ["pkcs12", "-in", str(src_abs), "-nokeys", "-nodes", "-out", str(tmp_pem)]
            if password:
                cmd += ["-passin", f"pass:{password}"]
            else:
                cmd += ["-passin", "pass:"]
            result = _run_openssl_check(*cmd)
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Export failed: {result.stderr.decode(errors='replace')}",
                )
            pem_data = tmp_pem.read_text()
            marker = "-----BEGIN CERTIFICATE-----"
            end_marker = "-----END CERTIFICATE-----"
            blocks = []
            start = 0
            while True:
                begin = pem_data.find(marker, start)
                if begin == -1:
                    break
                end = pem_data.find(end_marker, begin)
                if end == -1:
                    break
                end += len(end_marker)
                blocks.append(pem_data[begin:end])
                start = end
            selected = [blocks[i] for i in cert_indices if i < len(blocks)]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported source format: {src_suffix}",
            )

        if not selected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No certificates matched the requested indices.",
            )

        combined_pem = "\n".join(selected)
        tmp_input = tmp_path / "input.pem"
        tmp_input.write_text(combined_pem)

        if fmt == "pem":
            return combined_pem.encode()

        elif fmt == "der":
            tmp_out = tmp_path / "out.der"
            result = _run_openssl_check(
                "x509", "-in", str(tmp_input), "-out", str(tmp_out), "-outform", "DER"
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"DER conversion failed: {result.stderr.decode(errors='replace')}",
                )
            return tmp_out.read_bytes()

        elif fmt == "p12":
            tmp_out = tmp_path / "out.p12"
            cmd = [
                "pkcs12", "-export",
                "-in", str(tmp_input),
                "-nokeys",
                "-out", str(tmp_out),
            ]
            if password:
                cmd += ["-passout", f"pass:{password}"]
            else:
                cmd += ["-passout", "pass:"]
            result = _run_openssl_check(*cmd)
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"P12 export failed: {result.stderr.decode(errors='replace')}",
                )
            return tmp_out.read_bytes()

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported export format: {fmt}",
            )


def import_certificate(
    instance_id: int,
    target_file_path: str,
    cert_bytes: bytes,
    cert_filename: str,
    password: Optional[str] = None,
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
        mode = "ab"
        out_abs.write_bytes(out_abs.read_bytes() + b"\n" + cert_bytes if out_abs.exists() else cert_bytes)
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


def _extract_pem_blocks(pem_text: str) -> list:
    """Split PEM text into a list of individual certificate blocks."""
    marker = "-----BEGIN CERTIFICATE-----"
    end_marker = "-----END CERTIFICATE-----"
    blocks = []
    start = 0
    while True:
        begin = pem_text.find(marker, start)
        if begin == -1:
            break
        end = pem_text.find(end_marker, begin)
        if end == -1:
            break
        end += len(end_marker)
        blocks.append(pem_text[begin:end])
        start = end
    return blocks


def remove_certificates(
    instance_id: int,
    file_path: str,
    cert_indices: List[int],
    password: Optional[str] = None,
) -> dict:
    """Remove one or more certificates from a PEM or PKCS12 file.

    Args:
        instance_id: NiFi instance ID.
        file_path: Relative path to the cert file within the repo.
        cert_indices: 0-based indices of certificates to remove.
        password: Password for encrypted P12 files.

    Returns:
        dict with success, message, commit_sha.
    """
    abs_path = resolve_cert_file_path(instance_id, file_path)
    repository = get_repository_for_instance(instance_id)
    suffix = abs_path.suffix.lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        if suffix == ".pem":
            blocks = _extract_pem_blocks(abs_path.read_text())
            if not blocks:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No certificates found in the file.",
                )
            remaining = [b for i, b in enumerate(blocks) if i not in cert_indices]
            if not remaining:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove all certificates; at least one must remain.",
                )
            abs_path.write_text("\n".join(remaining) + "\n")

        elif suffix == ".p12":
            passin = f"pass:{password}" if password else "pass:"
            passout = f"pass:{password}" if password else "pass:"

            tmp_certs = tmp_path / "certs.pem"
            tmp_key = tmp_path / "key.pem"

            # Extract certs
            result = _run_openssl_check(
                "pkcs12", "-in", str(abs_path), "-nokeys", "-nodes",
                "-out", str(tmp_certs), "-passin", passin,
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to extract certificates: {result.stderr.decode(errors='replace')}",
                )

            # Extract private key (may not exist — ignore failure)
            key_result = _run_openssl_check(
                "pkcs12", "-in", str(abs_path), "-nocerts", "-nodes",
                "-out", str(tmp_key), "-passin", passin,
            )
            has_key = key_result.returncode == 0 and tmp_key.exists() and tmp_key.stat().st_size > 0

            blocks = _extract_pem_blocks(tmp_certs.read_text())
            if not blocks:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No certificates found in the P12 file.",
                )
            remaining = [b for i, b in enumerate(blocks) if i not in cert_indices]
            if not remaining:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove all certificates; at least one must remain.",
                )
            tmp_certs.write_text("\n".join(remaining) + "\n")

            # Rebuild P12
            cmd = ["pkcs12", "-export", "-in", str(tmp_certs), "-out", str(abs_path), "-passout", passout]
            if has_key:
                cmd += ["-inkey", str(tmp_key)]
            result = _run_openssl_check(*cmd)
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to rebuild P12: {result.stderr.decode(errors='replace')}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {suffix}",
            )

    removed_count = len(cert_indices)
    commit_sha = _commit_file(repository, abs_path, f"remove {removed_count} cert(s)")
    return {
        "success": True,
        "message": f"Removed {removed_count} certificate(s) from '{file_path}'.",
        "commit_sha": commit_sha,
    }


def add_certificate(
    instance_id: int,
    file_path: str,
    cert_pem: str,
    password: Optional[str] = None,
) -> dict:
    """Add a new PEM certificate to an existing PEM or PKCS12 store.

    Args:
        instance_id: NiFi instance ID.
        file_path: Relative path to the cert file within the repo.
        cert_pem: PEM-encoded certificate text (must include BEGIN/END headers).
        password: Password for encrypted P12 files.

    Returns:
        dict with success, message, commit_sha.
    """
    if "-----BEGIN CERTIFICATE-----" not in cert_pem:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PEM: must contain '-----BEGIN CERTIFICATE-----' header.",
        )

    abs_path = resolve_cert_file_path(instance_id, file_path)
    repository = get_repository_for_instance(instance_id)
    suffix = abs_path.suffix.lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        if suffix == ".pem":
            existing = abs_path.read_text()
            separator = "\n" if existing and not existing.endswith("\n") else ""
            abs_path.write_text(existing + separator + cert_pem.strip() + "\n")

        elif suffix == ".p12":
            passin = f"pass:{password}" if password else "pass:"
            passout = f"pass:{password}" if password else "pass:"

            tmp_certs = tmp_path / "certs.pem"
            tmp_key = tmp_path / "key.pem"

            # Extract existing certs
            result = _run_openssl_check(
                "pkcs12", "-in", str(abs_path), "-nokeys", "-nodes",
                "-out", str(tmp_certs), "-passin", passin,
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to extract certificates: {result.stderr.decode(errors='replace')}",
                )

            # Extract private key (may not exist — ignore failure)
            key_result = _run_openssl_check(
                "pkcs12", "-in", str(abs_path), "-nocerts", "-nodes",
                "-out", str(tmp_key), "-passin", passin,
            )
            has_key = key_result.returncode == 0 and tmp_key.exists() and tmp_key.stat().st_size > 0

            # Append new cert
            existing = tmp_certs.read_text()
            separator = "\n" if existing and not existing.endswith("\n") else ""
            tmp_certs.write_text(existing + separator + cert_pem.strip() + "\n")

            # Rebuild P12
            cmd = ["pkcs12", "-export", "-in", str(tmp_certs), "-out", str(abs_path), "-passout", passout]
            if has_key:
                cmd += ["-inkey", str(tmp_key)]
            result = _run_openssl_check(*cmd)
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to rebuild P12: {result.stderr.decode(errors='replace')}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {suffix}",
            )

    commit_sha = _commit_file(repository, abs_path, "add certificate")
    return {
        "success": True,
        "message": f"Certificate added to '{file_path}'.",
        "commit_sha": commit_sha,
    }


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
        result = _run_openssl_check(
            "genrsa", "-out", str(tmp_key), str(key_size)
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Key generation failed: {result.stderr.decode(errors='replace')}",
            )

        # Generate self-signed certificate
        result = _run_openssl_check(
            "req", "-new", "-x509",
            "-key", str(tmp_key),
            "-out", str(tmp_cert),
            "-days", str(validity_days),
            "-subj", subject_dn,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Certificate generation failed: {result.stderr.decode(errors='replace')}",
            )

        # Package as PKCS12
        result = _run_openssl_check(
            "pkcs12", "-export",
            "-in", str(tmp_cert),
            "-inkey", str(tmp_key),
            "-out", str(out_abs),
            "-passout", f"pass:{password}",
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
            "req", "-new", "-x509",
            "-key", str(tmp_key),
            "-out", str(out_abs),
            "-days", str(validity_days),
            "-subj", subject_dn,
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
