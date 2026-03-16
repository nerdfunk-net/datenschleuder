"""
Certificate Manager router.

Provides endpoints for browsing, parsing, converting, exporting, importing,
and creating TLS keystores/truststores associated with NiFi instances.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import Response

from core.auth import require_permission
from models.cert_manager import (
    CertFileListResponse,
    FileCertificatesResponse,
    ConvertRequest,
    ConvertResponse,
    ExportRequest,
    CreateKeystoreRequest,
    CreateTruststoreRequest,
    KeystoreCreateResponse,
    NifiPasswordsResponse,
    RemoveCertificatesRequest,
    AddCertificateRequest,
    CertModifyResponse,
)
from services.cert_manager.file_service import (
    list_cert_files,
    get_nifi_passwords as _get_nifi_passwords,
)
from services.cert_manager.cert_parser import parse_cert_file
from services.cert_manager.cert_operations import (
    convert_cert_file,
    export_certificates,
    import_certificate,
    create_new_keystore,
    create_new_truststore,
    resolve_cert_file_path,
    remove_certificates,
    add_certificate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cert-manager", tags=["cert-manager"])


@router.get(
    "/instances/{instance_id}/files",
    response_model=CertFileListResponse,
    dependencies=[Depends(require_permission("nifi", "read"))],
)
async def get_cert_files(instance_id: int) -> CertFileListResponse:
    """List all *.pem and *.p12 files in the git repository of a NiFi instance."""
    files = list_cert_files(instance_id)
    return CertFileListResponse(instance_id=instance_id, files=files)


@router.get(
    "/instances/{instance_id}/certificates",
    response_model=FileCertificatesResponse,
    dependencies=[Depends(require_permission("nifi", "read"))],
)
async def get_certificates(
    instance_id: int,
    file_path: str = Query(
        ..., description="Relative path to the cert file within the repo"
    ),
    password: Optional[str] = Query(
        None, description="Password for encrypted P12 files"
    ),
) -> FileCertificatesResponse:
    """Parse and return certificate details from a specific file."""
    abs_path = resolve_cert_file_path(instance_id, file_path)
    return parse_cert_file(abs_path, password)


@router.get(
    "/instances/{instance_id}/nifi-passwords",
    response_model=NifiPasswordsResponse,
    dependencies=[Depends(require_permission("nifi", "read"))],
)
async def get_nifi_passwords(
    instance_id: int,
    file_path: str = Query(...),
) -> NifiPasswordsResponse:
    """Return nifi.properties password entries found in the directory of the given .p12 file."""
    passwords = _get_nifi_passwords(instance_id, file_path)
    return NifiPasswordsResponse(
        instance_id=instance_id,
        file_path=file_path,
        passwords=passwords,
    )


@router.post(
    "/convert",
    response_model=ConvertResponse,
    dependencies=[Depends(require_permission("nifi", "write"))],
)
async def convert_certificate(request: ConvertRequest) -> ConvertResponse:
    """Convert a certificate file between PEM and PKCS12 formats."""
    result = convert_cert_file(
        instance_id=request.instance_id,
        file_path=request.file_path,
        target_format=request.target_format,
        output_filename=request.output_filename,
        password=request.password,
    )
    return ConvertResponse(**result)


@router.post(
    "/export",
    dependencies=[Depends(require_permission("nifi", "read"))],
)
async def export_certs(request: ExportRequest) -> Response:
    """Export selected certificates from a file as a downloadable file."""
    content_map = {
        "pem": ("application/x-pem-file", "exported-certs.pem"),
        "der": ("application/x-x509-ca-cert", "exported-cert.der"),
        "p12": ("application/x-pkcs12", "exported-keystore.p12"),
    }

    if request.format not in content_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format: {request.format}",
        )

    content_type, filename = content_map[request.format]
    data = export_certificates(
        instance_id=request.instance_id,
        file_path=request.file_path,
        cert_indices=request.cert_indices,
        fmt=request.format,
        password=request.password,
    )

    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/import",
    dependencies=[Depends(require_permission("nifi", "write"))],
)
async def import_cert(
    instance_id: int = Query(...),
    target_file_path: str = Query(...),
    password: Optional[str] = Query(None),
    file: UploadFile = File(...),
) -> dict:
    """Import an uploaded certificate file into the git repository."""
    cert_bytes = await file.read()
    if not cert_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    return import_certificate(
        instance_id=instance_id,
        target_file_path=target_file_path,
        cert_bytes=cert_bytes,
        cert_filename=file.filename or "certificate.pem",
        password=password,
    )


@router.post(
    "/create-keystore",
    response_model=KeystoreCreateResponse,
    dependencies=[Depends(require_permission("nifi", "write"))],
)
async def create_keystore(request: CreateKeystoreRequest) -> KeystoreCreateResponse:
    """Create a new PKCS12 keystore with a self-signed certificate."""
    result = create_new_keystore(
        instance_id=request.instance_id,
        filename=request.filename,
        password=request.password,
        subject_cn=request.subject_cn,
        subject_ou=request.subject_ou,
        subject_o=request.subject_o,
        subject_c=request.subject_c,
        validity_days=request.validity_days,
        key_size=request.key_size,
    )
    return KeystoreCreateResponse(**result)


@router.post(
    "/create-truststore",
    response_model=KeystoreCreateResponse,
    dependencies=[Depends(require_permission("nifi", "write"))],
)
async def create_truststore(request: CreateTruststoreRequest) -> KeystoreCreateResponse:
    """Create a new PEM truststore with a self-signed certificate."""
    result = create_new_truststore(
        instance_id=request.instance_id,
        filename=request.filename,
        subject_cn=request.subject_cn,
        subject_ou=request.subject_ou,
        subject_o=request.subject_o,
        subject_c=request.subject_c,
        validity_days=request.validity_days,
    )
    return KeystoreCreateResponse(**result)


@router.post(
    "/remove-certificates",
    response_model=CertModifyResponse,
    dependencies=[Depends(require_permission("nifi", "write"))],
)
async def remove_certs(request: RemoveCertificatesRequest) -> CertModifyResponse:
    """Remove selected certificates from a PEM or PKCS12 file and commit the change."""
    result = remove_certificates(
        instance_id=request.instance_id,
        file_path=request.file_path,
        cert_indices=request.cert_indices,
        password=request.password,
    )
    return CertModifyResponse(**result)


@router.post(
    "/add-certificate",
    response_model=CertModifyResponse,
    dependencies=[Depends(require_permission("nifi", "write"))],
)
async def add_cert(request: AddCertificateRequest) -> CertModifyResponse:
    """Add a PEM certificate to an existing store and commit the change."""
    result = add_certificate(
        instance_id=request.instance_id,
        file_path=request.file_path,
        cert_pem=request.cert_pem,
        password=request.password,
    )
    return CertModifyResponse(**result)
