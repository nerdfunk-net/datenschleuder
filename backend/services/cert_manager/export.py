"""Certificate export, PEM block parsing, add, and remove operations."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, status

from services.cert_manager._openssl import _run_openssl_check
from services.cert_manager.file_service import (
    get_repository_for_instance,
    resolve_cert_file_path,
)
from services.cert_manager.git_integration import _commit_file


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
            blocks = _extract_pem_blocks(pem_data)
            selected = [blocks[i] for i in cert_indices if i < len(blocks)]

        elif src_suffix == ".p12":
            # Convert all certs from P12 to temp PEM first
            tmp_pem = tmp_path / "all.pem"
            cmd = [
                "pkcs12",
                "-in",
                str(src_abs),
                "-nokeys",
                "-nodes",
                "-out",
                str(tmp_pem),
            ]
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
            blocks = _extract_pem_blocks(tmp_pem.read_text())
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
                "pkcs12",
                "-export",
                "-in",
                str(tmp_input),
                "-nokeys",
                "-out",
                str(tmp_out),
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
                "pkcs12",
                "-in",
                str(abs_path),
                "-nokeys",
                "-nodes",
                "-out",
                str(tmp_certs),
                "-passin",
                passin,
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to extract certificates: {result.stderr.decode(errors='replace')}",
                )

            # Extract private key (may not exist — ignore failure)
            key_result = _run_openssl_check(
                "pkcs12",
                "-in",
                str(abs_path),
                "-nocerts",
                "-nodes",
                "-out",
                str(tmp_key),
                "-passin",
                passin,
            )
            has_key = (
                key_result.returncode == 0
                and tmp_key.exists()
                and tmp_key.stat().st_size > 0
            )

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
            cmd = [
                "pkcs12",
                "-export",
                "-in",
                str(tmp_certs),
                "-out",
                str(abs_path),
                "-passout",
                passout,
            ]
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
                "pkcs12",
                "-in",
                str(abs_path),
                "-nokeys",
                "-nodes",
                "-out",
                str(tmp_certs),
                "-passin",
                passin,
            )
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to extract certificates: {result.stderr.decode(errors='replace')}",
                )

            # Extract private key (may not exist — ignore failure)
            key_result = _run_openssl_check(
                "pkcs12",
                "-in",
                str(abs_path),
                "-nocerts",
                "-nodes",
                "-out",
                str(tmp_key),
                "-passin",
                passin,
            )
            has_key = (
                key_result.returncode == 0
                and tmp_key.exists()
                and tmp_key.stat().st_size > 0
            )

            # Append new cert
            existing = tmp_certs.read_text()
            separator = "\n" if existing and not existing.endswith("\n") else ""
            tmp_certs.write_text(existing + separator + cert_pem.strip() + "\n")

            # Rebuild P12
            cmd = [
                "pkcs12",
                "-export",
                "-in",
                str(tmp_certs),
                "-out",
                str(abs_path),
                "-passout",
                passout,
            ]
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
