"""NiFi models: NifiServer, NifiCluster, NifiClusterServer, NifiClusterInstance,
NifiInstance, RegistryFlow, RegistryFlowMetadata, FlowView, HierarchyValue.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    LargeBinary,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class NifiServer(Base):
    """Physical/virtual server that hosts a NiFi process."""

    __tablename__ = "nifi_servers"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(String(255), unique=True, nullable=False, index=True)
    hostname = Column(String(1024), nullable=False)
    credential_id = Column(Integer, ForeignKey("credentials.id"), nullable=True)
    installation_type = Column(
        String(50), nullable=False, default="bare"
    )  # docker, bare
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    cluster_memberships = relationship(
        "NifiClusterServer", back_populates="server", cascade="all, delete-orphan"
    )
    nifi_instances = relationship("NifiInstance", back_populates="server")


class NifiCluster(Base):
    """A NiFi cluster formed by one or more NiFi servers."""

    __tablename__ = "nifi_clusters"

    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(String(255), unique=True, nullable=False, index=True)
    hierarchy_attribute = Column(String(255), nullable=False)
    hierarchy_value = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    members = relationship(
        "NifiClusterInstance", back_populates="cluster", cascade="all, delete-orphan"
    )


class NifiClusterServer(Base):
    """Association table: links servers to clusters, with primary flag."""

    __tablename__ = "nifi_cluster_servers"

    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(
        Integer,
        ForeignKey("nifi_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    server_id = Column(
        Integer,
        ForeignKey("nifi_servers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    is_primary = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships (legacy - NifiCluster.members now uses NifiClusterInstance)
    cluster = relationship("NifiCluster", foreign_keys=[cluster_id])
    server = relationship("NifiServer", back_populates="cluster_memberships")


class NifiClusterInstance(Base):
    """Association table: links NiFi instances to clusters, with primary flag."""

    __tablename__ = "nifi_cluster_instances"

    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(
        Integer,
        ForeignKey("nifi_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instance_id = Column(
        Integer,
        ForeignKey("nifi_instances.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    is_primary = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    cluster = relationship("NifiCluster", back_populates="members")
    instance = relationship("NifiInstance", back_populates="cluster_membership")


class NifiInstance(Base):
    """NiFi instance model - one instance per top hierarchy value."""

    __tablename__ = "nifi_instances"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    hierarchy_attribute = Column(String(255), nullable=True)
    hierarchy_value = Column(String(255), nullable=True, index=True)
    server_id = Column(Integer, ForeignKey("nifi_servers.id"), nullable=True)
    nifi_url = Column(String(1000), nullable=False)
    username = Column(String(255), nullable=True)
    password_encrypted = Column(LargeBinary, nullable=True)
    use_ssl = Column(Boolean, nullable=False, default=True)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    certificate_name = Column(String(255), nullable=True)
    check_hostname = Column(Boolean, nullable=False, default=True)
    oidc_provider_id = Column(String(255), nullable=True)
    git_config_repo_id = Column(
        Integer, ForeignKey("git_repositories.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    registry_flows = relationship(
        "RegistryFlow", back_populates="nifi_instance", cascade="all, delete-orphan"
    )
    server = relationship("NifiServer", back_populates="nifi_instances")
    git_config_repo = relationship("GitRepository", foreign_keys=[git_config_repo_id])
    cluster_membership = relationship(
        "NifiClusterInstance", back_populates="instance", uselist=False
    )

    __table_args__ = (
        Index("idx_nifi_instances_hierarchy", "hierarchy_attribute", "hierarchy_value"),
    )


class RegistryFlow(Base):
    """Registry flow - stores selected flows from NiFi registries."""

    __tablename__ = "registry_flows"

    id = Column(Integer, primary_key=True, index=True)
    nifi_instance_id = Column(
        Integer,
        ForeignKey("nifi_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nifi_instance_name = Column(String(255), nullable=False, index=True)
    nifi_instance_url = Column(String(1000), nullable=False)
    registry_id = Column(String(255), nullable=False)
    registry_name = Column(String(255), nullable=False)
    bucket_id = Column(String(255), nullable=False, index=True)
    bucket_name = Column(String(255), nullable=False)
    flow_id = Column(String(255), nullable=False, index=True)
    flow_name = Column(String(255), nullable=False)
    flow_description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    nifi_instance = relationship("NifiInstance", back_populates="registry_flows")
    flow_metadata = relationship(
        "RegistryFlowMetadata",
        back_populates="registry_flow",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_registry_flows_instance_flow", "nifi_instance_id", "flow_id"),
    )


class RegistryFlowMetadata(Base):
    """Per-flow key-value metadata stored locally (not in NiFi)."""

    __tablename__ = "registry_flow_metadata"

    id = Column(Integer, primary_key=True, index=True)
    registry_flow_id = Column(
        Integer,
        ForeignKey("registry_flows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)
    is_mandatory = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    registry_flow = relationship("RegistryFlow", back_populates="flow_metadata")

    __table_args__ = (Index("idx_registry_flow_metadata_flow_id", "registry_flow_id"),)


class FlowView(Base):
    """Flow view configuration - stores which columns to display."""

    __tablename__ = "flow_views"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    visible_columns = Column(JSON, nullable=False)
    column_widths = Column(JSON, nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
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


class HierarchyValue(Base):
    """Hierarchy values - stores individual values for each attribute."""

    __tablename__ = "nifi_hierarchy_values"

    id = Column(Integer, primary_key=True, index=True)
    attribute_name = Column(String(255), nullable=False, index=True)
    value = Column(String(255), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("idx_hierarchy_values_attr", "attribute_name"),)


# NifiFlow is intentionally NOT defined here as a static ORM model.
# The nifi_flows table is dynamic — its columns are generated from the hierarchy
# configuration. It is created/replaced by hierarchy_service.create_nifi_flows_table().
