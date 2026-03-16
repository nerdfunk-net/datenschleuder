"""PKI Manager router — CA and certificate management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response

from core.auth import require_permission, verify_admin_token, verify_token
from dependencies import get_encryption_service
from models.pki import (
    CAResponse,
    CertificateListResponse,
    CertificateResponse,
    CreateCARequest,
    CreateCertificateRequest,
    ExportCAPKCS12WithKeyRequest,
    ExportPKCS12Request,
    ExportPrivateKeyRequest,
    RevokeCertificateRequest,
)
from services.pki_service import PKIService

router = APIRouter(prefix="/api/pki", tags=["pki"])

_pki_service = PKIService()


def _get_ca_or_404():
    ca = _pki_service.ca_repo.get_active_ca()
    if not ca:
        raise HTTPException(status_code=404, detail="No Certificate Authority found")
    return ca


def _get_cert_or_404(cert_id: int):
    cert = _pki_service.cert_repo.get_by_id(cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return cert


# --------------------------------------------------------------------------- CA


@router.get("/ca", response_model=CAResponse)
async def get_ca(user: dict = Depends(verify_token)):
    return _get_ca_or_404()


@router.post(
    "/ca",
    response_model=CAResponse,
    status_code=201,
    dependencies=[Depends(require_permission("pki", "write"))],
)
async def create_ca(
    request: CreateCARequest,
    user: dict = Depends(verify_token),
    encryption_service=Depends(get_encryption_service),
):
    return _pki_service.create_ca(
        request, encryption_service, created_by=user.get("sub")
    )


@router.get("/ca/cert")
async def get_ca_cert():
    ca = _get_ca_or_404()
    filename = f"{ca.common_name.replace(' ', '_')}.ca.pem"
    return Response(
        content=ca.cert_pem.encode(),
        media_type="application/x-pem-file",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/ca/export/pkcs12")
async def export_ca_pkcs12():
    ca = _get_ca_or_404()
    p12_bytes = _pki_service.export_ca_pkcs12(ca)
    filename = f"{ca.common_name.replace(' ', '_')}.ca.p12"
    return Response(
        content=p12_bytes,
        media_type="application/x-pkcs12",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/ca/export/pkcs12/withkey")
async def export_ca_pkcs12_with_key(
    request: ExportCAPKCS12WithKeyRequest,
    user: dict = Depends(verify_admin_token),
    encryption_service=Depends(get_encryption_service),
):
    ca = _get_ca_or_404()
    p12_bytes = _pki_service.export_ca_pkcs12_with_key(
        ca, encryption_service, request.password
    )
    filename = f"{ca.common_name.replace(' ', '_')}.ca.p12"
    return Response(
        content=p12_bytes,
        media_type="application/x-pkcs12",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/ca", status_code=204)
async def delete_ca(user: dict = Depends(verify_admin_token)):
    deleted = _pki_service.delete_ca()
    if not deleted:
        raise HTTPException(status_code=404, detail="No Certificate Authority found")
    return Response(status_code=204)


# ---------------------------------------------------------------------- Certs


@router.get("/certificates", response_model=CertificateListResponse)
async def list_certificates(user: dict = Depends(verify_token)):
    ca = _get_ca_or_404()
    certs = _pki_service.cert_repo.get_all_for_ca(ca.id)
    return CertificateListResponse(certificates=certs, total=len(certs))


@router.post(
    "/certificates",
    response_model=CertificateResponse,
    status_code=201,
    dependencies=[Depends(require_permission("pki", "write"))],
)
async def create_certificate(
    request: CreateCertificateRequest,
    user: dict = Depends(verify_token),
    encryption_service=Depends(get_encryption_service),
):
    ca = _get_ca_or_404()
    return _pki_service.create_certificate(
        ca, request, encryption_service, created_by=user.get("sub")
    )


@router.get("/certificates/{cert_id}", response_model=CertificateResponse)
async def get_certificate(cert_id: int, user: dict = Depends(verify_token)):
    return _get_cert_or_404(cert_id)


@router.post(
    "/certificates/{cert_id}/revoke",
    response_model=CertificateResponse,
    dependencies=[Depends(require_permission("pki", "write"))],
)
async def revoke_certificate(
    cert_id: int,
    request: RevokeCertificateRequest,
    user: dict = Depends(verify_token),
):
    cert = _get_cert_or_404(cert_id)
    if cert.is_revoked:
        raise HTTPException(status_code=400, detail="Certificate is already revoked")
    return _pki_service.cert_repo.revoke(cert_id, request.reason)


# ------------------------------------------------------------------- Exports


@router.get("/certificates/{cert_id}/export/cert")
async def export_cert(cert_id: int, user: dict = Depends(verify_token)):
    cert = _get_cert_or_404(cert_id)
    filename = f"{cert.common_name.replace(' ', '_')}.crt.pem"
    return Response(
        content=cert.cert_pem.encode(),
        media_type="application/x-pem-file",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/certificates/{cert_id}/export/pem")
async def export_pem(cert_id: int, user: dict = Depends(verify_token)):
    cert = _get_cert_or_404(cert_id)
    ca = _get_ca_or_404()
    bundle = _pki_service.export_pem_bundle(cert, ca)
    filename = f"{cert.common_name.replace(' ', '_')}.pem"
    return Response(
        content=bundle,
        media_type="application/x-pem-file",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/certificates/{cert_id}/export/pkcs12")
async def export_pkcs12(
    cert_id: int,
    request: ExportPKCS12Request,
    user: dict = Depends(verify_token),
    encryption_service=Depends(get_encryption_service),
):
    cert = _get_cert_or_404(cert_id)
    ca = _get_ca_or_404()
    p12_bytes = _pki_service.export_pkcs12(
        cert, ca, encryption_service, request.password
    )
    filename = f"{cert.common_name.replace(' ', '_')}.p12"
    return Response(
        content=p12_bytes,
        media_type="application/x-pkcs12",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/certificates/{cert_id}/export/key")
async def export_private_key(
    cert_id: int,
    request: ExportPrivateKeyRequest,
    user: dict = Depends(verify_token),
    encryption_service=Depends(get_encryption_service),
):
    cert = _get_cert_or_404(cert_id)
    key_pem = _pki_service.export_private_key(
        cert, encryption_service, request.passphrase
    )
    filename = f"{cert.common_name.replace(' ', '_')}.key.pem"
    return Response(
        content=key_pem,
        media_type="application/x-pem-file",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------------------------------------------------------------------- CRL


@router.get("/crl")
async def get_crl(encryption_service=Depends(get_encryption_service)):
    ca = _get_ca_or_404()
    crl_pem = _pki_service.generate_crl(ca, encryption_service)
    return Response(
        content=crl_pem,
        media_type="application/x-pem-file",
        headers={"Content-Disposition": 'attachment; filename="ca.crl.pem"'},
    )
