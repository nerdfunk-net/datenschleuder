"""NiFi certificate management endpoints."""

import logging
from pathlib import Path
from typing import List, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from core.auth import require_permission
from dependencies import get_certificate_manager, get_git_service
from services.settings.git_repository_service import GitRepositoryService as GitRepositoryManager
from services.settings.git.paths import repo_path
from services.cert_manager.cert_parser import parse_p12_file, parse_pem_file

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


class UploadStoreResponse(BaseModel):
    """Result of uploading a keystore or truststore to a git repository."""

    filename: str
    subject: str
    issuer: str
    is_expired: bool
    fingerprint_sha256: str
    commit_sha: str


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


@router.post(
    "/upload-store",
    response_model=UploadStoreResponse,
    dependencies=[Depends(require_permission("nifi", "write"))],
)
async def upload_store(
    git_repo_id: int = Form(...),
    store_type: Literal["keystore", "truststore"] = Form(...),
    store_format: Literal["pkcs12", "pem"] = Form(...),
    password: str = Form(""),
    file: UploadFile = File(...),
    git_service=Depends(get_git_service),
) -> UploadStoreResponse:
    """Upload a keystore or truststore file to a git repository.

    The file is saved with a canonical name (keystore.p12 / truststore.p12 for PKCS12,
    keystore.pem / truststore.pem for PEM), committed, and pushed. Certificate subject
    info is returned so the caller can skip a separate read-store call.
    """
    repository = _git_repo_manager.get_repository(git_repo_id)
    if repository is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository {git_repo_id} not found.",
        )

    if not repository.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Git repository '{repository['name']}' is inactive.",
        )

    extension = ".p12" if store_format == "pkcs12" else ".pem"
    filename = f"{store_type}{extension}"

    root: Path = repo_path(repository)
    dest_path = (root / filename).resolve()

    # Prevent directory traversal
    try:
        dest_path.relative_to(root.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid destination path.",
        )

    # Sync with remote before writing
    try:
        git_service.fetch_and_reset(repository)
    except Exception as exc:
        logger.warning("fetch_and_reset failed for repo %d: %s", git_repo_id, exc)

    # Write uploaded file to repo
    file_data = await file.read()
    dest_path.write_bytes(file_data)

    # Parse certificate info from the uploaded bytes
    try:
        if store_format == "pkcs12":
            certs = parse_p12_file(dest_path, password or None)
        else:
            certs = parse_pem_file(dest_path)

        if not certs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No certificates found in the uploaded file.",
            )

        # For keystores prefer the cert with a private key; for truststores take the first
        cert = next((c for c in certs if c.has_private_key), certs[0])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse uploaded file: {exc}",
        ) from exc

    # Commit and push
    result = git_service.commit_and_push(
        repository=repository,
        message=f"[Wizard] Upload {filename}",
        files=[filename],
    )
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit store file: {result.message}",
        )

    logger.info(
        "Uploaded %s to repo %s (commit %s)",
        filename,
        repository.get("name"),
        result.commit_sha,
    )

    return UploadStoreResponse(
        filename=filename,
        subject=cert.subject,
        issuer=cert.issuer,
        is_expired=cert.is_expired,
        fingerprint_sha256=cert.fingerprint_sha256,
        commit_sha=result.commit_sha or "",
    )
