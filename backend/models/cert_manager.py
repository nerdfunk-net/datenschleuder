"""Pydantic schemas for Certificate Manager operations."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class CertFileInfo(BaseModel):
    """Information about a certificate file in the git repository."""

    path: str
    name: str
    file_type: str  # "pem" | "p12"
    size: Optional[int] = None


class CertFileListResponse(BaseModel):
    """Response listing cert files for a NiFi instance."""

    instance_id: int
    files: List[CertFileInfo]


class CertificateInfo(BaseModel):
    """Parsed information about a single X.509 certificate."""

    index: int
    subject: str
    issuer: str
    serial: str
    not_before: str
    not_after: str
    is_expired: bool
    san: List[str]
    key_usage: List[str]
    signature_algorithm: str
    fingerprint_sha256: str
    raw_text: str  # full openssl output
    has_private_key: bool = False  # True when the paired private key is present in the P12


class FileCertificatesResponse(BaseModel):
    """Parsed certificates from a single file."""

    file_path: str
    file_type: str
    certificates: List[CertificateInfo]


class ConvertRequest(BaseModel):
    """Request to convert a certificate file between formats."""

    instance_id: int
    file_path: str
    target_format: str  # "pem" | "p12"
    output_filename: str
    password: Optional[str] = None


class ConvertResponse(BaseModel):
    """Response from a certificate conversion operation."""

    success: bool
    message: str
    output_path: str
    commit_sha: Optional[str] = None


class ExportRequest(BaseModel):
    """Request to export one or more certificates from a file."""

    instance_id: int
    file_path: str
    cert_indices: List[int]
    format: str  # "pem" | "der" | "p12"
    password: Optional[str] = None


class ImportRequest(BaseModel):
    """Request to import a certificate into an existing store."""

    instance_id: int
    target_file_path: str
    password: Optional[str] = None


class CreateKeystoreRequest(BaseModel):
    """Request to create a new PKCS12 keystore."""

    instance_id: int
    filename: str
    password: str
    subject_cn: str
    subject_ou: Optional[str] = None
    subject_o: Optional[str] = None
    subject_c: Optional[str] = None
    validity_days: int = 365
    key_size: int = 2048


class CreateTruststoreRequest(BaseModel):
    """Request to create a new PEM truststore."""

    instance_id: int
    filename: str
    subject_cn: str
    subject_ou: Optional[str] = None
    subject_o: Optional[str] = None
    subject_c: Optional[str] = None
    validity_days: int = 365


class KeystoreCreateResponse(BaseModel):
    """Response from creating a keystore or truststore."""

    success: bool
    message: str
    output_path: str
    commit_sha: Optional[str] = None


class NifiPasswordEntry(BaseModel):
    key: str    # e.g. "nifi.security.keystorePasswd"
    value: str  # the password string


class NifiPasswordsResponse(BaseModel):
    instance_id: int
    file_path: str
    passwords: List[NifiPasswordEntry]
