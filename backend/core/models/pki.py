"""PKI models: PKIAuthority, PKICertificate."""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class PKIAuthority(Base):
    """Certificate Authority — single CA enforced at service layer."""

    __tablename__ = "pki_ca"

    id = Column(Integer, primary_key=True, index=True)
    common_name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    country = Column(String(2), nullable=True)
    state = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    org_unit = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    cert_pem = Column(Text, nullable=False)
    private_key_encrypted = Column(LargeBinary, nullable=False)
    serial_number = Column(String(64), nullable=False, unique=True)
    key_size = Column(Integer, nullable=False, default=4096)
    not_before = Column(DateTime(timezone=True), nullable=False)
    not_after = Column(DateTime(timezone=True), nullable=False)
    created_by = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    certificates = relationship(
        "PKICertificate", back_populates="ca", cascade="all, delete-orphan"
    )


class PKICertificate(Base):
    """Certificate issued by the local CA."""

    __tablename__ = "pki_certificates"

    id = Column(Integer, primary_key=True, index=True)
    ca_id = Column(
        Integer,
        ForeignKey("pki_ca.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    common_name = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    country = Column(String(2), nullable=True)
    state = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    org_unit = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    cert_type = Column(String(20), nullable=False, default="server")
    san_dns = Column(JSON, nullable=True)
    san_ip = Column(JSON, nullable=True)
    cert_pem = Column(Text, nullable=False)
    private_key_encrypted = Column(LargeBinary, nullable=False)
    serial_number = Column(String(64), nullable=False, unique=True)
    key_size = Column(Integer, nullable=False, default=2048)
    not_before = Column(DateTime(timezone=True), nullable=False)
    not_after = Column(DateTime(timezone=True), nullable=False)
    validity_days = Column(Integer, nullable=False, default=365)
    is_revoked = Column(Boolean, nullable=False, default=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revocation_reason = Column(String(50), nullable=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    ca = relationship("PKIAuthority", back_populates="certificates")

    __table_args__ = (
        Index("idx_pki_certificates_ca_id", "ca_id"),
        Index("idx_pki_certificates_serial", "serial_number"),
        Index("idx_pki_certificates_revoked", "is_revoked"),
        Index("idx_pki_certificates_type", "cert_type"),
    )
