"""
PKI Service — Certificate Authority and certificate lifecycle management.

All cryptographic operations use the `cryptography` library exclusively.
No subprocess or OpenSSL shell calls.
Private keys are stored Fernet-encrypted; public certs are stored plaintext PEM.
"""

from __future__ import annotations

import ipaddress
import logging
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, List, Optional

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
from cryptography.x509 import CRLReason, ReasonFlags
from fastapi import HTTPException

from repositories.pki_repository import PKICARepository, PKICertificateRepository

if TYPE_CHECKING:
    from services.nifi.encryption import EncryptionService

logger = logging.getLogger(__name__)

_REASON_FLAG_MAP = {
    "unspecified": ReasonFlags.unspecified,
    "keyCompromise": ReasonFlags.key_compromise,
    "affiliationChanged": ReasonFlags.affiliation_changed,
    "superseded": ReasonFlags.superseded,
    "cessationOfOperation": ReasonFlags.cessation_of_operation,
}


def _build_name(
    common_name: str,
    organization: Optional[str],
    country: Optional[str],
    state: Optional[str],
    city: Optional[str],
    org_unit: Optional[str],
    email: Optional[str],
) -> x509.Name:
    attrs = [x509.NameAttribute(NameOID.COMMON_NAME, common_name)]
    if organization:
        attrs.append(x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization))
    if country:
        attrs.append(x509.NameAttribute(NameOID.COUNTRY_NAME, country))
    if state:
        attrs.append(x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state))
    if city:
        attrs.append(x509.NameAttribute(NameOID.LOCALITY_NAME, city))
    if org_unit:
        attrs.append(x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, org_unit))
    if email:
        attrs.append(x509.NameAttribute(NameOID.EMAIL_ADDRESS, email))
    return x509.Name(attrs)


class PKIService:
    """Business logic for the PKI Manager feature."""

    def __init__(self):
        self.ca_repo = PKICARepository()
        self.cert_repo = PKICertificateRepository()

    # ------------------------------------------------------------------ CA --

    def create_ca(
        self,
        request,
        encryption_service: "EncryptionService",
        created_by: Optional[str] = None,
    ):
        """Create the single root CA. Raises 400 if a CA already exists."""
        if self.ca_repo.count() > 0:
            raise HTTPException(
                status_code=400,
                detail="A Certificate Authority already exists. Delete it first.",
            )

        key = rsa.generate_private_key(public_exponent=65537, key_size=request.key_size)

        now = datetime.now(timezone.utc)
        not_after = now + timedelta(days=request.validity_days)
        serial = x509.random_serial_number()

        subject = _build_name(
            request.common_name,
            request.organization,
            request.country,
            request.state,
            request.city,
            request.org_unit,
            request.email,
        )

        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(subject)
            .public_key(key.public_key())
            .serial_number(serial)
            .not_valid_before(now)
            .not_valid_after(not_after)
            .add_extension(
                x509.BasicConstraints(ca=True, path_length=None), critical=True
            )
            .add_extension(
                x509.KeyUsage(
                    key_cert_sign=True,
                    crl_sign=True,
                    digital_signature=True,
                    content_commitment=False,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(key.public_key()),
                critical=False,
            )
            .sign(key, hashes.SHA256())
        )

        key_pem = key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ).decode()
        cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
        encrypted_key = encryption_service.encrypt(key_pem)

        return self.ca_repo.create(
            common_name=request.common_name,
            organization=request.organization,
            country=request.country,
            state=request.state,
            city=request.city,
            org_unit=request.org_unit,
            email=request.email,
            cert_pem=cert_pem,
            private_key_encrypted=encrypted_key,
            serial_number=format(serial, "x"),
            key_size=request.key_size,
            not_before=now,
            not_after=not_after,
            created_by=created_by,
        )

    def delete_ca(self) -> bool:
        """Delete all issued certificates and then the CA itself."""
        ca = self.ca_repo.get_active_ca()
        if not ca:
            return False
        self.cert_repo.delete_all_for_ca(ca.id)
        return self.ca_repo.delete(ca.id)

    # -------------------------------------------------------------- Certs --

    def create_certificate(
        self,
        ca,
        request,
        encryption_service: "EncryptionService",
        created_by: Optional[str] = None,
    ):
        """Issue a certificate signed by the given CA."""
        ca_key_pem = encryption_service.decrypt(ca.private_key_encrypted)
        ca_key = serialization.load_pem_private_key(ca_key_pem.encode(), password=None)
        ca_cert = x509.load_pem_x509_certificate(ca.cert_pem.encode())

        key = rsa.generate_private_key(public_exponent=65537, key_size=request.key_size)

        now = datetime.now(timezone.utc)
        not_after = now + timedelta(days=request.validity_days)
        serial = x509.random_serial_number()

        subject = _build_name(
            request.common_name,
            request.organization,
            request.country,
            request.state,
            request.city,
            request.org_unit,
            request.email,
        )

        # Parse SANs
        san_dns_list: List[str] = []
        san_ip_list: List[str] = []
        san_entries: List[x509.GeneralName] = []

        if request.san_dns:
            for entry in request.san_dns.split(","):
                name = entry.strip()
                if name:
                    san_dns_list.append(name)
                    san_entries.append(x509.DNSName(name))

        if request.san_ip:
            for entry in request.san_ip.split(","):
                addr = entry.strip()
                if addr:
                    try:
                        san_ip_list.append(addr)
                        san_entries.append(x509.IPAddress(ipaddress.ip_address(addr)))
                    except ValueError:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid IP address in san_ip: {addr}",
                        )

        # Extended Key Usage by cert type
        if request.cert_type == "server":
            eku = x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH])
        elif request.cert_type == "client":
            eku = x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH])
        elif request.cert_type == "server+client":
            eku = x509.ExtendedKeyUsage(
                [ExtendedKeyUsageOID.SERVER_AUTH, ExtendedKeyUsageOID.CLIENT_AUTH]
            )
        else:  # user
            eku = x509.ExtendedKeyUsage(
                [ExtendedKeyUsageOID.CLIENT_AUTH, ExtendedKeyUsageOID.EMAIL_PROTECTION]
            )

        builder = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(ca_cert.subject)
            .public_key(key.public_key())
            .serial_number(serial)
            .not_valid_before(now)
            .not_valid_after(not_after)
            .add_extension(
                x509.BasicConstraints(ca=False, path_length=None), critical=True
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    key_encipherment=(
                        request.cert_type in ("server", "client", "server+client")
                    ),
                    content_commitment=False,
                    key_cert_sign=False,
                    crl_sign=False,
                    data_encipherment=False,
                    key_agreement=False,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            .add_extension(eku, critical=False)
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(key.public_key()),
                critical=False,
            )
        )

        if san_entries:
            builder = builder.add_extension(
                x509.SubjectAlternativeName(san_entries), critical=False
            )

        cert = builder.sign(ca_key, hashes.SHA256())

        cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
        key_pem = key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ).decode()
        encrypted_key = encryption_service.encrypt(key_pem)

        return self.cert_repo.create(
            ca_id=ca.id,
            common_name=request.common_name,
            organization=request.organization,
            country=request.country,
            state=request.state,
            city=request.city,
            org_unit=request.org_unit,
            email=request.email,
            cert_type=request.cert_type,
            san_dns=san_dns_list if san_dns_list else None,
            san_ip=san_ip_list if san_ip_list else None,
            cert_pem=cert_pem,
            private_key_encrypted=encrypted_key,
            serial_number=format(serial, "x"),
            key_size=request.key_size,
            not_before=now,
            not_after=not_after,
            validity_days=request.validity_days,
            is_revoked=False,
            created_by=created_by,
        )

    # ------------------------------------------------------------ Exports --

    def export_ca_pkcs12(self, ca) -> bytes:
        """Export CA certificate as PKCS#12 without private key."""
        ca_cert_obj = x509.load_pem_x509_certificate(ca.cert_pem.encode())
        return pkcs12.serialize_key_and_certificates(
            name=ca.common_name.encode(),
            key=None,
            cert=ca_cert_obj,
            cas=None,
            encryption_algorithm=serialization.NoEncryption(),
        )

    def export_ca_pkcs12_with_key(
        self, ca, encryption_service: "EncryptionService", password: str
    ) -> bytes:
        """Export CA certificate and private key as PKCS#12."""
        key_pem = encryption_service.decrypt(ca.private_key_encrypted)
        private_key = serialization.load_pem_private_key(
            key_pem.encode(), password=None
        )
        ca_cert_obj = x509.load_pem_x509_certificate(ca.cert_pem.encode())
        return pkcs12.serialize_key_and_certificates(
            name=ca.common_name.encode(),
            key=private_key,
            cert=ca_cert_obj,
            cas=None,
            encryption_algorithm=serialization.BestAvailableEncryption(
                password.encode()
            ),
        )

    def export_pem_bundle(self, cert, ca) -> bytes:
        """Return cert PEM + CA cert PEM concatenated."""
        return (cert.cert_pem + ca.cert_pem).encode()

    def export_pkcs12(
        self, cert, ca, encryption_service: "EncryptionService", password: str
    ) -> bytes:
        """Export cert + key as PKCS#12."""
        key_pem = encryption_service.decrypt(cert.private_key_encrypted)
        private_key = serialization.load_pem_private_key(
            key_pem.encode(), password=None
        )
        cert_obj = x509.load_pem_x509_certificate(cert.cert_pem.encode())
        ca_cert_obj = x509.load_pem_x509_certificate(ca.cert_pem.encode())

        return pkcs12.serialize_key_and_certificates(
            name=cert.common_name.encode(),
            key=private_key,
            cert=cert_obj,
            cas=[ca_cert_obj],
            encryption_algorithm=serialization.BestAvailableEncryption(
                password.encode()
            ),
        )

    def export_private_key(
        self,
        cert,
        encryption_service: "EncryptionService",
        passphrase: Optional[str] = None,
    ) -> bytes:
        """Export the private key as PEM, optionally encrypted."""
        key_pem = encryption_service.decrypt(cert.private_key_encrypted)
        private_key = serialization.load_pem_private_key(
            key_pem.encode(), password=None
        )

        algo = (
            serialization.BestAvailableEncryption(passphrase.encode())
            if passphrase
            else serialization.NoEncryption()
        )
        return private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            algo,
        )

    def test_nifi_connection(
        self,
        cert,
        ca,
        encryption_service: "EncryptionService",
        nifi_url: str,
        verify_ssl: bool = True,
        check_hostname: bool = True,
    ) -> dict:
        """Run step-by-step certificate diagnostics against a NiFi URL."""
        import json
        import os
        import socket
        import ssl
        import tempfile
        import time
        import urllib.error
        import urllib.parse
        import urllib.request

        steps: list = []
        error_count = 0
        warning_count = 0
        nifi_version: Optional[str] = None
        cert_tmp_path: Optional[str] = None
        key_tmp_path: Optional[str] = None
        ca_tmp_path: Optional[str] = None

        _STEP_NAMES = {
            1: "Certificate Validity",
            2: "CA Certificate",
            3: "Key Decryption",
            4: "SSL Context Creation",
            5: "URL Parsing & DNS",
            6: "TCP Connection",
            7: "TLS Handshake",
            8: "NiFi API Call",
        }

        def _add(num: int, status: str, message: str, details: Optional[dict] = None) -> None:
            nonlocal error_count, warning_count
            if status == "error":
                error_count += 1
            elif status == "warning":
                warning_count += 1
            steps.append(
                {
                    "step": num,
                    "name": _STEP_NAMES.get(num, f"Step {num}"),
                    "status": status,
                    "message": message,
                    "details": details or {},
                }
            )

        def _skip(start: int, end: int = 8, reason: str = "Skipped due to earlier failure") -> None:
            for i in range(start, end + 1):
                _add(i, "skipped", reason)

        def _result() -> dict:
            return {
                "status": "error" if error_count > 0 else "success",
                "steps": steps,
                "summary": {
                    "all_passed": error_count == 0,
                    "error_count": error_count,
                    "warning_count": warning_count,
                    "nifi_version": nifi_version,
                },
            }

        def _not_after(obj) -> datetime:
            try:
                return obj.not_valid_after_utc
            except AttributeError:
                dt = obj.not_valid_after
                return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

        def _not_before(obj) -> datetime:
            try:
                return obj.not_valid_before_utc
            except AttributeError:
                dt = obj.not_valid_before
                return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

        try:
            # ── Step 1: Certificate Validity ──────────────────────────────────
            cert_obj = None
            try:
                cert_obj = x509.load_pem_x509_certificate(cert.cert_pem.encode())
                now = datetime.now(timezone.utc)
                not_before_dt = _not_before(cert_obj)
                not_after_dt = _not_after(cert_obj)
                is_expired = now > not_after_dt
                days_remaining = max(0, (not_after_dt - now).days)

                san_dns: List[str] = []
                san_ip: List[str] = []
                try:
                    san_ext = cert_obj.extensions.get_extension_for_class(
                        x509.SubjectAlternativeName
                    )
                    san_dns = [n.value for n in san_ext.value.get_values_for_type(x509.DNSName)]
                    san_ip = [str(n.value) for n in san_ext.value.get_values_for_type(x509.IPAddress)]
                except x509.ExtensionNotFound:
                    pass

                has_client_auth = False
                has_server_auth = False
                try:
                    eku_ext = cert_obj.extensions.get_extension_for_class(x509.ExtendedKeyUsage)
                    has_client_auth = ExtendedKeyUsageOID.CLIENT_AUTH in eku_ext.value
                    has_server_auth = ExtendedKeyUsageOID.SERVER_AUTH in eku_ext.value
                except x509.ExtensionNotFound:
                    pass

                d1 = {
                    "subject": cert_obj.subject.rfc4514_string(),
                    "san_dns": san_dns,
                    "san_ip": san_ip,
                    "not_before": not_before_dt.isoformat(),
                    "not_after": not_after_dt.isoformat(),
                    "is_expired": is_expired,
                    "days_remaining": days_remaining if not is_expired else None,
                    "is_revoked": cert.is_revoked,
                    "has_client_auth": has_client_auth,
                    "has_server_auth": has_server_auth,
                    "cert_type": cert.cert_type,
                }
                if cert.is_revoked:
                    _add(1, "warning",
                         f"Certificate is revoked (reason: {cert.revocation_reason or 'unspecified'})", d1)
                elif is_expired:
                    _add(1, "error",
                         f"Certificate expired on {not_after_dt.strftime('%Y-%m-%d')}", d1)
                else:
                    _add(1, "success",
                         f"Valid until {not_after_dt.strftime('%Y-%m-%d')} ({days_remaining} days remaining)", d1)
            except Exception as exc:
                _add(1, "error", str(exc))
                _skip(2)
                return _result()

            # ── Step 2: CA Certificate ────────────────────────────────────────
            ca_cert_obj = None
            try:
                ca_cert_obj = x509.load_pem_x509_certificate(ca.cert_pem.encode())
                now = datetime.now(timezone.utc)
                ca_not_after = _not_after(ca_cert_obj)
                ca_expired = now > ca_not_after
                issuer_match = cert_obj.issuer == ca_cert_obj.subject

                d2 = {
                    "ca_subject": ca_cert_obj.subject.rfc4514_string(),
                    "ca_not_before": _not_before(ca_cert_obj).isoformat(),
                    "ca_not_after": ca_not_after.isoformat(),
                    "is_ca_expired": ca_expired,
                    "issuer_match": issuer_match,
                }
                if ca_expired:
                    _add(2, "error",
                         f"CA expired on {ca_not_after.strftime('%Y-%m-%d')}", d2)
                    _skip(3)
                    return _result()
                elif not issuer_match:
                    _add(2, "error",
                         "Certificate issuer DN does not match CA subject DN", d2)
                    _skip(3)
                    return _result()
                else:
                    _add(2, "success",
                         f"CA valid, issuer matches ({ca_cert_obj.subject.rfc4514_string()})", d2)
            except Exception as exc:
                _add(2, "error", str(exc))
                _skip(3)
                return _result()

            # ── Step 3: Key Decryption ────────────────────────────────────────
            key_pem_bytes: Optional[bytes] = None
            try:
                key_pem_str = encryption_service.decrypt(cert.private_key_encrypted)
                key_pem_bytes = key_pem_str.encode()
                private_key = serialization.load_pem_private_key(key_pem_bytes, password=None)
                key_type = type(private_key).__name__
                key_size_bits = getattr(private_key, "key_size", None)
                algo = "RSA" if "RSA" in key_type else key_type.replace("PrivateKey", "")
                _add(3, "success",
                     f"{algo}-{key_size_bits} private key decrypted successfully",
                     {"key_algorithm": algo, "key_size_bits": key_size_bits})
            except Exception as exc:
                _add(3, "error", f"Failed to decrypt key: {exc}")
                _skip(4)
                return _result()

            # ── Step 4: SSL Context Creation ──────────────────────────────────
            ssl_context: Optional[ssl.SSLContext] = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".pem", delete=False) as f:
                    f.write(cert.cert_pem.encode())
                    cert_tmp_path = f.name
                with tempfile.NamedTemporaryFile(suffix=".key", delete=False) as f:
                    f.write(key_pem_bytes)
                    key_tmp_path = f.name
                with tempfile.NamedTemporaryFile(suffix=".pem", delete=False) as f:
                    f.write(ca.cert_pem.encode())
                    ca_tmp_path = f.name

                ssl_context = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH)
                ssl_context.load_cert_chain(certfile=cert_tmp_path, keyfile=key_tmp_path)
                ssl_context.load_verify_locations(cafile=ca_tmp_path)

                if not verify_ssl:
                    ssl_context.check_hostname = False
                    ssl_context.verify_mode = ssl.CERT_NONE
                elif not check_hostname:
                    ssl_context.check_hostname = False
                    ssl_context.verify_mode = ssl.CERT_REQUIRED

                _add(4, "success",
                     f"SSL context created with client certificate (verify_ssl={verify_ssl}, check_hostname={check_hostname})",
                     {"verify_ssl": verify_ssl, "check_hostname": check_hostname,
                      "loaded_client_cert": True, "loaded_ca_cert": True})
            except Exception as exc:
                _add(4, "error", f"Failed to create SSL context: {exc}")
                _skip(5)
                return _result()

            # ── Step 5: URL Parsing & DNS ─────────────────────────────────────
            hostname: Optional[str] = None
            port: Optional[int] = None
            base_url: Optional[str] = None
            try:
                raw = nifi_url.rstrip("/")
                for suffix in ("/nifi-api", "/nifi"):
                    if raw.endswith(suffix):
                        raw = raw[: -len(suffix)]
                        break
                if "://" not in raw:
                    raw = f"https://{raw}"
                base_url = raw
                parsed = urllib.parse.urlparse(raw)
                hostname = parsed.hostname
                port = parsed.port or 443
                addrs = socket.getaddrinfo(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
                resolved_ips = list({info[4][0] for info in addrs})
                _add(5, "success",
                     f"Resolved {hostname}:{port} → {', '.join(resolved_ips)}",
                     {"hostname": hostname, "port": port, "scheme": parsed.scheme,
                      "resolved_ips": resolved_ips, "nifi_api_url": f"{base_url}/nifi-api"})
            except socket.gaierror as exc:
                _add(5, "error",
                     f"DNS resolution failed for {hostname or nifi_url}: {exc}",
                     {"hostname": hostname, "port": port})
                _skip(6)
                return _result()
            except Exception as exc:
                _add(5, "error", str(exc))
                _skip(6)
                return _result()

            # ── Step 6: TCP Connection ────────────────────────────────────────
            try:
                t0 = time.monotonic()
                tcp_sock = socket.create_connection((hostname, port), timeout=5)
                latency_ms = round((time.monotonic() - t0) * 1000, 1)
                tcp_sock.close()
                _add(6, "success",
                     f"TCP connection to {hostname}:{port} established in {latency_ms} ms",
                     {"host": hostname, "port": port, "latency_ms": latency_ms})
            except socket.timeout:
                _add(6, "error", f"Connection to {hostname}:{port} timed out (5 s)",
                     {"host": hostname, "port": port})
                _skip(7)
                return _result()
            except ConnectionRefusedError:
                _add(6, "error", f"Connection refused to {hostname}:{port}",
                     {"host": hostname, "port": port})
                _skip(7)
                return _result()
            except Exception as exc:
                _add(6, "error", str(exc))
                _skip(7)
                return _result()

            # ── Step 7: TLS Handshake ─────────────────────────────────────────
            try:
                tcp_sock2 = socket.create_connection((hostname, port), timeout=10)
                with ssl_context.wrap_socket(tcp_sock2, server_hostname=hostname) as ssl_sock:
                    protocol = ssl_sock.version()
                    cipher = ssl_sock.cipher()
                    server_cert_der = ssl_sock.getpeercert(binary_form=True)

                server_cert_info: dict = {}
                if server_cert_der:
                    try:
                        sc = x509.load_der_x509_certificate(server_cert_der)
                        server_cert_info["server_cert_subject"] = sc.subject.rfc4514_string()
                        server_cert_info["server_cert_issuer"] = sc.issuer.rfc4514_string()
                        server_cert_info["server_cert_not_before"] = sc.not_valid_before_utc.isoformat()
                        server_cert_info["server_cert_not_after"] = _not_after(sc).isoformat()
                        try:
                            san_ext2 = sc.extensions.get_extension_for_class(
                                x509.SubjectAlternativeName
                            )
                            server_cert_info["server_cert_san_dns"] = [
                                n.value for n in san_ext2.value.get_values_for_type(x509.DNSName)
                            ]
                            server_cert_info["server_cert_san_ip"] = [
                                str(n.value)
                                for n in san_ext2.value.get_values_for_type(x509.IPAddress)
                            ]
                        except x509.ExtensionNotFound:
                            pass
                    except Exception:
                        pass

                _add(7, "success",
                     f"Handshake successful ({protocol}, {cipher[0] if cipher else 'unknown'})",
                     {"protocol": protocol, "cipher_name": cipher[0] if cipher else None,
                      "cipher_bits": cipher[2] if cipher else None, **server_cert_info})
            except ssl.SSLError as exc:
                _add(7, "error", f"TLS handshake failed: {exc}",
                     {"ssl_error": str(exc), "hostname": hostname, "port": port})
                _add(8, "skipped", "Skipped due to TLS failure")
                return _result()
            except Exception as exc:
                _add(7, "error", str(exc))
                _add(8, "skipped", "Skipped due to TLS failure")
                return _result()

            # ── Step 8: NiFi API Call ─────────────────────────────────────────
            api_url = f"{base_url}/nifi-api/flow/status"
            try:
                handler = urllib.request.HTTPSHandler(context=ssl_context)
                opener = urllib.request.build_opener(handler)
                req = urllib.request.Request(api_url)
                with opener.open(req, timeout=10) as resp:
                    http_status = resp.status
                    body = resp.read()
                data = json.loads(body)
                if "controllerStatus" in data:
                    nifi_version = data["controllerStatus"].get("version")
                _add(8, "success",
                     f"NiFi API responded (HTTP {http_status})"
                     + (f", version {nifi_version}" if nifi_version else ""),
                     {"url": api_url, "http_status": http_status, "nifi_version": nifi_version})
            except urllib.error.HTTPError as exc:
                _add(8, "error", f"HTTP {exc.code}: {exc.reason}",
                     {"url": api_url, "http_status": exc.code, "error": str(exc)})
            except Exception as exc:
                _add(8, "error", str(exc), {"url": api_url})

            return _result()

        finally:
            for path in (cert_tmp_path, key_tmp_path, ca_tmp_path):
                if path:
                    try:
                        os.unlink(path)
                    except OSError:
                        pass

    def generate_crl(self, ca, encryption_service: "EncryptionService") -> bytes:
        """Generate a CRL for all revoked certificates."""
        key_pem = encryption_service.decrypt(ca.private_key_encrypted)
        ca_key = serialization.load_pem_private_key(key_pem.encode(), password=None)
        ca_cert = x509.load_pem_x509_certificate(ca.cert_pem.encode())

        now = datetime.now(timezone.utc)
        builder = (
            x509.CertificateRevocationListBuilder()
            .issuer_name(ca_cert.subject)
            .last_update(now)
            .next_update(now + timedelta(days=1))
        )

        revoked_certs = self.cert_repo.get_revoked_for_ca(ca.id)
        for cert in revoked_certs:
            reason_flag = _REASON_FLAG_MAP.get(
                cert.revocation_reason or "unspecified", ReasonFlags.unspecified
            )
            revoked = (
                x509.RevokedCertificateBuilder()
                .serial_number(int(cert.serial_number, 16))
                .revocation_date(cert.revoked_at or now)
                .add_extension(CRLReason(reason_flag), critical=False)
                .build()
            )
            builder = builder.add_revoked_certificate(revoked)

        crl = builder.sign(ca_key, hashes.SHA256())
        return crl.public_bytes(serialization.Encoding.PEM)
