"""NiFi certificate management endpoints."""

import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.auth import require_permission
from dependencies import get_certificate_manager
from git_repositories_manager import GitRepositoryManager
from services.settings.git.paths import repo_path
from services.cert_manager.cert_parser import parse_p12_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/certificates", tags=["nifi-certificates"])

_git_repo_manager = GitRepositoryManager()


class CertificateInfo(BaseModel):
    name: str


class CertificatesResponse(BaseModel):
    certificates: List[CertificateInfo]


class ReadStoreRequest(BaseModel):
    """Request to read a PKCS12 keystore or truststore from a git repository."""

    git_repo_id: int
    filename: str  # e.g. "keystore.p12" or "truststore.p12"
    password: str


class ReadStoreResponse(BaseModel):
    """Certificate subject info extracted from a PKCS12 store."""

    subject: str
    issuer: str
    is_expired: bool
    fingerprint_sha256: str


@router.get("/", response_model=CertificatesResponse)
async def get_certificates(
    current_user: dict = Depends(require_permission("nifi", "read")),
    certificate_manager=Depends(get_certificate_manager),
):
    """Get list of available client certificates for NiFi authentication."""
    certificates = certificate_manager.get_certificates()
    return CertificatesResponse(
        certificates=[CertificateInfo(name=cert.name) for cert in certificates]
    )


@router.post(
    "/read-store",
    response_model=ReadStoreResponse,
    dependencies=[Depends(require_permission("nifi", "read"))],
)
async def read_store(request: ReadStoreRequest) -> ReadStoreResponse:
    """Read a PKCS12 keystore or truststore from a git repository and return the certificate subject.

    Only PKCS12 (.p12) containers are supported.
    """
    repository = _git_repo_manager.get_repository(request.git_repo_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository {request.git_repo_id} not found.",
        )

    if not repository.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Git repository '{repository['name']}' is inactive.",
        )

    root: Path = repo_path(repository)
    file_path = (root / request.filename).resolve()

    # Prevent directory traversal
    try:
        file_path.relative_to(root.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{request.filename}' not found in repository.",
        )

    if file_path.suffix.lower() != ".p12":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PKCS12 (.p12) containers are supported.",
        )

    certs = parse_p12_file(file_path, request.password)

    if not certs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No certificates found in the PKCS12 file.",
        )

    # Prefer the end-entity cert with a private key (keystore), else first cert (truststore)
    cert = next((c for c in certs if c.has_private_key), certs[0])

    return ReadStoreResponse(
        subject=cert.subject,
        issuer=cert.issuer,
        is_expired=cert.is_expired,
        fingerprint_sha256=cert.fingerprint_sha256,
    )
