"""NiFi certificate management endpoints."""

import logging
from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_permission
from services.nifi.certificate_manager import certificate_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nifi/certificates", tags=["nifi-certificates"])


class CertificateInfo(BaseModel):
    name: str


class CertificatesResponse(BaseModel):
    certificates: List[CertificateInfo]


@router.get("/", response_model=CertificatesResponse)
async def get_certificates(
    current_user: dict = Depends(require_permission("nifi", "read")),
):
    """Get list of available client certificates for NiFi authentication."""
    certificates = certificate_manager.get_certificates()
    return CertificatesResponse(
        certificates=[CertificateInfo(name=cert.name) for cert in certificates]
    )
