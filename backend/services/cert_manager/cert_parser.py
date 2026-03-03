"""
Certificate parsing service.

Parses *.pem and *.p12 files using the `cryptography` library and
supplements with raw openssl text output via subprocess.
"""

from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, status

from models.cert_manager import CertificateInfo, FileCertificatesResponse

logger = logging.getLogger(__name__)


def _run_openssl(*args: str, input_data: Optional[bytes] = None, timeout: int = 30) -> str:
    """Run openssl with given arguments and return stdout as string."""
    try:
        result = subprocess.run(
            ["openssl", *args],
            input=input_data,
            capture_output=True,
            timeout=timeout,
        )
        return result.stdout.decode("utf-8", errors="replace")
    except FileNotFoundError:
        logger.warning("openssl binary not found; raw text will be unavailable")
        return ""
    except subprocess.TimeoutExpired:
        logger.warning("openssl timed out for args: %s", args)
        return ""
    except Exception as exc:
        logger.warning("openssl error: %s", exc)
        return ""


def _parse_crypto_cert(cert, index: int, raw_text: str, has_private_key: bool = False) -> CertificateInfo:
    """Convert a `cryptography` x509.Certificate to CertificateInfo."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes

    # Subject / Issuer
    def dn_string(name) -> str:
        parts = []
        for attr in name:
            parts.append(f"{attr.oid._name}={attr.value}")
        return ", ".join(parts) if parts else str(name)

    subject = dn_string(cert.subject)
    issuer = dn_string(cert.issuer)

    # Validity
    not_before_dt = cert.not_valid_before_utc if hasattr(cert, "not_valid_before_utc") else cert.not_valid_before.replace(tzinfo=timezone.utc)
    not_after_dt = cert.not_valid_after_utc if hasattr(cert, "not_valid_after_utc") else cert.not_valid_after.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    is_expired = now > not_after_dt

    # SANs
    san: List[str] = []
    try:
        ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
        for name_obj in ext.value:
            san.append(str(name_obj.value))
    except Exception:
        pass

    # Key Usage
    key_usage: List[str] = []
    try:
        ku = cert.extensions.get_extension_for_class(x509.KeyUsage).value
        for usage_name in [
            "digital_signature", "content_commitment", "key_encipherment",
            "data_encipherment", "key_agreement", "key_cert_sign",
            "crl_sign", "encipher_only", "decipher_only",
        ]:
            if getattr(ku, usage_name, False):
                key_usage.append(usage_name.replace("_", " ").title())
    except Exception:
        pass

    # Extended Key Usage
    try:
        eku = cert.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value
        for oid in eku:
            key_usage.append(oid._name)
    except Exception:
        pass

    # Fingerprint
    fp_bytes = cert.fingerprint(hashes.SHA256())
    fingerprint = ":".join(f"{b:02X}" for b in fp_bytes)

    return CertificateInfo(
        index=index,
        subject=subject,
        issuer=issuer,
        serial=hex(cert.serial_number),
        not_before=not_before_dt.isoformat(),
        not_after=not_after_dt.isoformat(),
        is_expired=is_expired,
        san=san,
        key_usage=key_usage,
        signature_algorithm=cert.signature_algorithm_oid._name,
        fingerprint_sha256=fingerprint,
        raw_text=raw_text,
        has_private_key=has_private_key,
    )


def parse_pem_file(file_path: Path) -> List[CertificateInfo]:
    """Parse all certificates from a PEM file."""
    from cryptography import x509
    from cryptography.hazmat.backends import default_backend

    pem_data = file_path.read_bytes()
    pem_str = pem_data.decode("utf-8", errors="replace")

    # Split on BEGIN CERTIFICATE markers
    marker = "-----BEGIN CERTIFICATE-----"
    end_marker = "-----END CERTIFICATE-----"

    certs: List[CertificateInfo] = []
    idx = 0
    start = 0
    while True:
        begin = pem_str.find(marker, start)
        if begin == -1:
            break
        end = pem_str.find(end_marker, begin)
        if end == -1:
            break
        end += len(end_marker)
        block = pem_str[begin:end]

        # Get raw openssl text for this cert block
        raw_text = _run_openssl("x509", "-text", "-noout", input_data=block.encode())

        try:
            cert_obj = x509.load_pem_x509_certificate(block.encode(), default_backend())
            certs.append(_parse_crypto_cert(cert_obj, idx, raw_text))
            idx += 1
        except Exception as exc:
            logger.warning("Failed to parse PEM cert block %d in %s: %s", idx, file_path, exc)

        start = end

    return certs


def parse_p12_file(file_path: Path, password: Optional[str] = None) -> List[CertificateInfo]:
    """Parse certificates from a PKCS12 (.p12) file."""
    from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates

    p12_data = file_path.read_bytes()
    pwd_bytes = password.encode() if password else None

    try:
        private_key, cert, additional_certs = load_key_and_certificates(p12_data, pwd_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to load PKCS12 file: {exc}",
        ) from exc

    # Get raw openssl info
    openssl_args = ["pkcs12", "-info", "-nokeys", "-nodes"]
    if password:
        openssl_args += ["-passin", f"pass:{password}"]
    else:
        openssl_args += ["-passin", "pass:"]
    raw_p12_text = _run_openssl(*openssl_args, input_data=p12_data)

    certs: List[CertificateInfo] = []
    idx = 0

    if cert is not None:
        # Get per-cert raw text
        from cryptography.hazmat.primitives.serialization import Encoding
        pem_bytes = cert.public_bytes(Encoding.PEM)
        raw_text = _run_openssl("x509", "-text", "-noout", input_data=pem_bytes)
        certs.append(_parse_crypto_cert(cert, idx, raw_text or raw_p12_text, has_private_key=private_key is not None))
        idx += 1

    for extra_cert in (additional_certs or []):
        from cryptography.hazmat.primitives.serialization import Encoding
        pem_bytes = extra_cert.public_bytes(Encoding.PEM)
        raw_text = _run_openssl("x509", "-text", "-noout", input_data=pem_bytes)
        certs.append(_parse_crypto_cert(extra_cert, idx, raw_text))
        idx += 1

    return certs


def parse_cert_file(
    file_path: Path, password: Optional[str] = None
) -> FileCertificatesResponse:
    """Parse certificates from either a PEM or P12 file.

    Args:
        file_path: Absolute path to the certificate file.
        password: Optional password for encrypted P12 files.

    Returns:
        FileCertificatesResponse with all parsed certificates.
    """
    suffix = file_path.suffix.lower()

    if suffix == ".pem":
        certs = parse_pem_file(file_path)
        file_type = "pem"
    elif suffix == ".p12":
        certs = parse_p12_file(file_path, password)
        file_type = "p12"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {suffix}",
        )

    return FileCertificatesResponse(
        file_path=str(file_path),
        file_type=file_type,
        certificates=certs,
    )
