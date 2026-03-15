"""Pydantic models for PKI Manager feature."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


CertType = Literal["server", "client", "user", "server+client"]
RevocationReason = Literal[
    "unspecified",
    "keyCompromise",
    "affiliationChanged",
    "superseded",
    "cessationOfOperation",
]


class CreateCARequest(BaseModel):
    common_name: str = Field(min_length=1, max_length=255)
    organization: Optional[str] = None
    country: Optional[str] = Field(default=None, max_length=2)
    state: Optional[str] = None
    city: Optional[str] = None
    org_unit: Optional[str] = None
    email: Optional[str] = None
    validity_days: int = Field(default=3650, ge=1, le=36500)
    key_size: Literal[2048, 4096] = 4096


class CAResponse(BaseModel):
    id: int
    common_name: str
    organization: Optional[str]
    country: Optional[str]
    state: Optional[str]
    city: Optional[str]
    org_unit: Optional[str]
    email: Optional[str]
    cert_pem: str
    serial_number: str
    key_size: int
    not_before: datetime
    not_after: datetime
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CreateCertificateRequest(BaseModel):
    common_name: str = Field(min_length=1, max_length=255)
    organization: Optional[str] = None
    country: Optional[str] = Field(default=None, max_length=2)
    state: Optional[str] = None
    city: Optional[str] = None
    org_unit: Optional[str] = None
    email: Optional[str] = None
    cert_type: CertType = "server"
    validity_days: int = Field(default=365, ge=1, le=36500)
    key_size: Literal[2048, 4096] = 2048
    san_dns: Optional[str] = None  # comma-separated DNS names
    san_ip: Optional[str] = None   # comma-separated IP addresses


class CertificateResponse(BaseModel):
    id: int
    ca_id: int
    common_name: str
    organization: Optional[str]
    country: Optional[str]
    state: Optional[str]
    city: Optional[str]
    org_unit: Optional[str]
    email: Optional[str]
    cert_type: str
    san_dns: Optional[List[str]]
    san_ip: Optional[List[str]]
    cert_pem: str
    serial_number: str
    key_size: int
    not_before: datetime
    not_after: datetime
    validity_days: int
    is_revoked: bool
    revoked_at: Optional[datetime]
    revocation_reason: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CertificateListResponse(BaseModel):
    certificates: List[CertificateResponse]
    total: int


class RevokeCertificateRequest(BaseModel):
    reason: RevocationReason = "unspecified"


class ExportPKCS12Request(BaseModel):
    password: str = Field(min_length=1)


class ExportPrivateKeyRequest(BaseModel):
    passphrase: Optional[str] = None


class ExportCAPKCS12WithKeyRequest(BaseModel):
    password: str = Field(min_length=1)
