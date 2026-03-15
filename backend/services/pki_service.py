"""
PKI Service — Certificate Authority and certificate lifecycle management.

All cryptographic operations use the `cryptography` library exclusively.
No subprocess or OpenSSL shell calls.
Private keys are stored Fernet-encrypted; public certs are stored plaintext PEM.
"""

from __future__ import annotations

import ipaddress
import logging
import os
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

    def create_ca(self, request, encryption_service: "EncryptionService", created_by: Optional[str] = None):
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
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
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
                            status_code=400, detail=f"Invalid IP address in san_ip: {addr}"
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
                    key_encipherment=(request.cert_type in ("server", "client", "server+client")),
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

    def export_ca_pkcs12_with_key(self, ca, encryption_service: "EncryptionService", password: str) -> bytes:
        """Export CA certificate and private key as PKCS#12."""
        key_pem = encryption_service.decrypt(ca.private_key_encrypted)
        private_key = serialization.load_pem_private_key(key_pem.encode(), password=None)
        ca_cert_obj = x509.load_pem_x509_certificate(ca.cert_pem.encode())
        return pkcs12.serialize_key_and_certificates(
            name=ca.common_name.encode(),
            key=private_key,
            cert=ca_cert_obj,
            cas=None,
            encryption_algorithm=serialization.BestAvailableEncryption(password.encode()),
        )

    def export_pem_bundle(self, cert, ca) -> bytes:
        """Return cert PEM + CA cert PEM concatenated."""
        return (cert.cert_pem + ca.cert_pem).encode()

    def export_pkcs12(self, cert, ca, encryption_service: "EncryptionService", password: str) -> bytes:
        """Export cert + key as PKCS#12."""
        key_pem = encryption_service.decrypt(cert.private_key_encrypted)
        private_key = serialization.load_pem_private_key(key_pem.encode(), password=None)
        cert_obj = x509.load_pem_x509_certificate(cert.cert_pem.encode())
        ca_cert_obj = x509.load_pem_x509_certificate(ca.cert_pem.encode())

        return pkcs12.serialize_key_and_certificates(
            name=cert.common_name.encode(),
            key=private_key,
            cert=cert_obj,
            cas=[ca_cert_obj],
            encryption_algorithm=serialization.BestAvailableEncryption(password.encode()),
        )

    def export_private_key(
        self, cert, encryption_service: "EncryptionService", passphrase: Optional[str] = None
    ) -> bytes:
        """Export the private key as PEM, optionally encrypted."""
        key_pem = encryption_service.decrypt(cert.private_key_encrypted)
        private_key = serialization.load_pem_private_key(key_pem.encode(), password=None)

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
